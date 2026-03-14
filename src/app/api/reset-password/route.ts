import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { hashPassword, verifyAuthCode } from "@/app/lib/auth";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CODE_ATTEMPT_LIMIT = 5;
const INVALID_MESSAGE = "Invalid or expired reset code.";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const code = body?.code?.toString().trim();
    const newPassword = body?.newPassword?.toString() ?? "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Invalid reset code." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "reset-password",
      key: buildRateLimitKey(req, email),
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many reset attempts. Please try again later."
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordResetCode: true,
        passwordResetExpiresAt: true,
        passwordResetAttempts: true,
      },
    });

    if (!user || !user.passwordResetCode || !user.passwordResetExpiresAt) {
      return NextResponse.json(
        { error: INVALID_MESSAGE },
        { status: 400 }
      );
    }

    if (user.passwordResetExpiresAt < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetCode: null,
          passwordResetExpiresAt: null,
          passwordResetAttempts: 0,
        },
      });

      return NextResponse.json(
        { error: INVALID_MESSAGE },
        { status: 400 }
      );
    }

    if (user.passwordResetAttempts >= CODE_ATTEMPT_LIMIT) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetCode: null,
          passwordResetExpiresAt: null,
          passwordResetAttempts: 0,
        },
      });

      return NextResponse.json(
        { error: "Too many invalid attempts. Request a new reset code." },
        { status: 400 }
      );
    }

    const validCode = verifyAuthCode({
      email: user.email,
      code,
      purpose: "reset",
      hash: user.passwordResetCode,
    });

    if (!validCode) {
      const nextAttempts = user.passwordResetAttempts + 1;
      const invalidate = nextAttempts >= CODE_ATTEMPT_LIMIT;

      await prisma.user.update({
        where: { id: user.id },
        data: invalidate
          ? {
              passwordResetCode: null,
              passwordResetExpiresAt: null,
              passwordResetAttempts: 0,
            }
          : {
              passwordResetAttempts: nextAttempts,
            },
      });

      return NextResponse.json(
        {
          error: invalidate
            ? "Too many invalid attempts. Request a new reset code."
            : INVALID_MESSAGE,
        },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        passwordResetCode: null,
        passwordResetExpiresAt: null,
        passwordResetAttempts: 0,
      },
    });

    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Password updated successfully. Please log in again.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("reset-password POST error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}