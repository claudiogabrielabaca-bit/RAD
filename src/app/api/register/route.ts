import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  createSession,
  generateNumericCode,
  hashAuthCode,
  hashPassword,
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

const EMAIL_VERIFY_TTL_MINUTES = 20;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type PrismaErrorWithCode = {
  code: string;
};

function isPrismaError(
  error: unknown,
  code: "P2002"
): error is PrismaErrorWithCode {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === code
  );
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username: string) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = normalizeEmail(body?.email ?? "");
    const username = normalizeUsername(body?.username ?? "");
    const password = typeof body?.password === "string" ? body.password : "";
    const turnstileToken =
      typeof body?.turnstileToken === "string" ? body.turnstileToken : "";

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!isValidUsername(username)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3 to 20 characters and use only lowercase letters, numbers, or underscores.",
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "register",
      key: buildRateLimitKey(req, email),
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many registration attempts. Please try again later."
      );
    }

    const turnstile = await verifyTurnstileToken(turnstileToken, req);

    if (!turnstile.ok) {
      return NextResponse.json(
        { error: "Security check failed. Please try again." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      select: {
        email: true,
        username: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email or username already exists." },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    const passwordHash = await hashPassword(password);
    const verifyCode = generateNumericCode(6);
    const emailVerifyCode = hashAuthCode({
      email,
      code: verifyCode,
      purpose: "verify",
    });
    const emailVerifyExpiresAt = new Date(
      Date.now() + EMAIL_VERIFY_TTL_MINUTES * 60 * 1000
    );

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        emailVerified: false,
        emailVerifyCode,
        emailVerifyExpiresAt,
        emailVerifyAttempts: 0,
      },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    await createSession(user.id);

    let mailSent = false;

    try {
      const mailResult = await sendMail({
        to: user.email,
        subject: "Verify your RAD account",
        text: `Hello ${user.username},

Your verification code is: ${verifyCode}

This code expires in ${EMAIL_VERIFY_TTL_MINUTES} minutes.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2>Verify your RAD account</h2>
            <p>Hello <strong>${user.username}</strong>,</p>
            <p>Your verification code is:</p>
            <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">
              ${verifyCode}
            </div>
            <p>This code expires in <strong>${EMAIL_VERIFY_TTL_MINUTES} minutes</strong>.</p>
          </div>
        `,
      });

      console.log("register verification email sent:", mailResult?.id);
      mailSent = true;
    } catch (mailError) {
      console.error("register verification mail send error:", mailError);
    }

    return NextResponse.json(
      {
        ok: true,
        message: mailSent
          ? "Account created successfully. You're already signed in. Check your email to verify your account."
          : "Account created successfully. You're already signed in. Verification email could not be sent automatically.",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt.toISOString(),
        },
        devCode: process.env.NODE_ENV !== "production" ? verifyCode : undefined,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("register POST error:", error);

    if (isPrismaError(error, "P2002")) {
      return NextResponse.json(
        { error: "Email or username already exists." },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}