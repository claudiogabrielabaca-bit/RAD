import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateNumericCode, hashAuthCode } from "@/app/lib/auth";
import { sendMail } from "@/app/lib/mail";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PENDING_LOGIN_COOKIE = "rad_pending_login_email";
const PENDING_LOGIN_MAX_AGE_SEC = 10 * 60;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function getPendingLoginEmail() {
  const store = await cookies();
  const value = store.get(PENDING_LOGIN_COOKIE)?.value ?? "";
  return normalizeEmail(value);
}

async function setPendingLoginEmailCookie(email: string) {
  const store = await cookies();
  const expiresAt = new Date(Date.now() + PENDING_LOGIN_MAX_AGE_SEC * 1000);

  store.set({
    name: PENDING_LOGIN_COOKIE,
    value: email,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: PENDING_LOGIN_MAX_AGE_SEC,
    priority: "high",
  });
}

async function clearPendingLoginEmailCookie() {
  const store = await cookies();

  store.set({
    name: PENDING_LOGIN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high",
  });
}

export async function POST(req: Request) {
  try {
    const email = await getPendingLoginEmail();

    if (!email) {
      return NextResponse.json(
        { error: "Start the login flow again." },
        { status: 400 }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "resend-login-code",
      key: buildRateLimitKey(req, email),
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many requests. Please try again later."
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
      },
    });

    let devCode: string | undefined;

    if (!user || !user.emailVerified) {
      await clearPendingLoginEmailCookie();

      return NextResponse.json(
        { error: "Start the login flow again." },
        { status: 400 }
      );
    }

    const loginCode = generateNumericCode(6);
    const loginCodeHash = hashAuthCode({
      email: user.email,
      code: loginCode,
      purpose: "login",
    });
    const loginCodeExpiresAt = new Date(Date.now() + 1000 * 60 * 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginCode: loginCodeHash,
        loginCodeExpiresAt,
        loginCodeAttempts: 0,
      },
    });

    await setPendingLoginEmailCookie(user.email);

    devCode = process.env.NODE_ENV !== "production" ? loginCode : undefined;

    try {
      const mailResult = await sendMail({
        to: user.email,
        subject: "Your RAD login code",
        text: `Hello ${user.username},

Your login code is: ${loginCode}

This code expires in 10 minutes.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2>RAD login code</h2>
            <p>Hello <strong>${user.username}</strong>,</p>
            <p>Your login code is:</p>
            <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">
              ${loginCode}
            </div>
            <p>This code expires in <strong>10 minutes</strong>.</p>
          </div>
        `,
      });

      console.log("resend-login-code email sent:", mailResult?.id);
    } catch (mailError) {
      console.error("resend-login-code mail send error:", mailError);
    }

    return NextResponse.json(
      {
        ok: true,
        email: user.email,
        message: "Login code sent. Enter it to access your account.",
        devCode,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("resend-login-code POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}