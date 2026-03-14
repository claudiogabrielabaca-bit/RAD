import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { verifyAuthCode } from "@/app/lib/auth";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CODE_ATTEMPT_LIMIT = 5;
const INVALID_MESSAGE = "Invalid or expired verification code.";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const code = body?.code?.toString().trim();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "verify-email",
      key: buildRateLimitKey(req, email),
      limit: 12,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many verification attempts. Please try again later."
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        emailVerifyCode: true,
        emailVerifyExpiresAt: true,
        emailVerifyAttempts: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        ok: true,
        message: "Your email is already verified.",
      });
    }

    if (!user.emailVerifyCode || !user.emailVerifyExpiresAt) {
      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
    }

    if (user.emailVerifyExpiresAt < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifyCode: null,
          emailVerifyExpiresAt: null,
          emailVerifyAttempts: 0,
        },
      });

      return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
    }

    if (user.emailVerifyAttempts >= CODE_ATTEMPT_LIMIT) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifyCode: null,
          emailVerifyExpiresAt: null,
          emailVerifyAttempts: 0,
        },
      });

      return NextResponse.json(
        { error: "Too many invalid attempts. Request a new code." },
        { status: 400 }
      );
    }

    const validCode = verifyAuthCode({
      email: user.email,
      code,
      purpose: "verify",
      hash: user.emailVerifyCode,
    });

    if (!validCode) {
      const nextAttempts = user.emailVerifyAttempts + 1;
      const invalidate = nextAttempts >= CODE_ATTEMPT_LIMIT;

      await prisma.user.update({
        where: { id: user.id },
        data: invalidate
          ? {
              emailVerifyCode: null,
              emailVerifyExpiresAt: null,
              emailVerifyAttempts: 0,
            }
          : {
              emailVerifyAttempts: nextAttempts,
            },
      });

      return NextResponse.json(
        {
          error: invalidate
            ? "Too many invalid attempts. Request a new code."
            : INVALID_MESSAGE,
        },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyCode: null,
        emailVerifyExpiresAt: null,
        emailVerifyAttempts: 0,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Email verified successfully. Now you can log in.",
    });
  } catch (error) {
    console.error("verify-email POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}