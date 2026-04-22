import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateNumericCode,
  hashAuthCode,
  verifyPassword,
} from "@/app/lib/auth";
import { sendMail } from "@/app/lib/mail";
import { verifyTurnstileToken } from "@/app/lib/turnstile";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PENDING_LOGIN_COOKIE = "rad_pending_login_email";
const PENDING_LOGIN_MAX_AGE_SEC = 10 * 60;

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
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const password = body?.password?.toString() ?? "";
    const turnstileToken = body?.turnstileToken?.toString() ?? "";

    await clearPendingLoginEmailCookie();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "login",
      key: buildRateLimitKey(req, email),
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many login attempts. Please try again later."
      );
    }

    const turnstile = await verifyTurnstileToken(turnstileToken, req);

    if (!turnstile.ok) {
      return NextResponse.json(
        { error: "Security check failed. Please try again." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      const verifyCode = generateNumericCode(6);
      const verifyCodeHash = hashAuthCode({
        email: user.email,
        code: verifyCode,
        purpose: "verify",
      });
      const verifyExpiresAt = new Date(Date.now() + 1000 * 60 * 15);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifyCode: verifyCodeHash,
          emailVerifyExpiresAt: verifyExpiresAt,
          emailVerifyAttempts: 0,
        },
      });

      let emailSent = false;

      try {
        const mailResult = await sendMail({
          to: user.email,
          subject: "Verify your RAD account",
          text: `Hello ${user.username},

Your verification code is: ${verifyCode}

This code expires in 15 minutes.`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
              <h2>Verify your RAD account</h2>
              <p>Hello <strong>${user.username}</strong>,</p>
              <p>Your verification code is:</p>
              <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">
                ${verifyCode}
              </div>
              <p>This code expires in <strong>15 minutes</strong>.</p>
            </div>
          `,
        });

        console.log("login verification email sent:", mailResult?.id);
        emailSent = true;
      } catch (mailError) {
        console.error("login verification mail send error:", mailError);
      }

      return NextResponse.json(
        {
          error: emailSent
            ? "Verify your email before logging in."
            : "Verify your email before logging in. We could not send the verification email.",
          requiresVerification: true,
          email: user.email,
          emailSent,
          devCode:
            process.env.NODE_ENV !== "production" ? verifyCode : undefined,
        },
        { status: 403 }
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

    let emailSent = false;

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

      console.log("login code email sent:", mailResult?.id);
      emailSent = true;
    } catch (mailError) {
      console.error("login code mail send error:", mailError);
    }

    return NextResponse.json(
      {
        ok: true,
        requiresCode: true,
        email: user.email,
        emailSent,
        message: emailSent
          ? "Login code sent. Enter it to access your account."
          : "Login code generated, but the email could not be sent.",
        devCode: process.env.NODE_ENV !== "production" ? loginCode : undefined,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("login POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}