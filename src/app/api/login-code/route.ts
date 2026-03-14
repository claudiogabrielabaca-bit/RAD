import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { createSession, verifyAuthCode } from "@/app/lib/auth";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CODE_ATTEMPT_LIMIT = 5;
const INVALID_MESSAGE = "Invalid or expired login code.";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const code = body?.code?.toString().trim();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and login code are required." },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: INVALID_MESSAGE },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "login-code",
      key: buildRateLimitKey(req, email),
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many code attempts. Please try again later."
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        loginCode: true,
        loginCodeExpiresAt: true,
        loginCodeAttempts: true,
      },
    });

    if (
      !user ||
      !user.emailVerified ||
      !user.loginCode ||
      !user.loginCodeExpiresAt
    ) {
      return NextResponse.json(
        { error: INVALID_MESSAGE },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (user.loginCodeExpiresAt < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginCode: null,
          loginCodeExpiresAt: null,
          loginCodeAttempts: 0,
        },
      });

      return NextResponse.json(
        { error: INVALID_MESSAGE },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (user.loginCodeAttempts >= CODE_ATTEMPT_LIMIT) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginCode: null,
          loginCodeExpiresAt: null,
          loginCodeAttempts: 0,
        },
      });

      return NextResponse.json(
        { error: "Too many invalid attempts. Request a new login code." },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const validCode = verifyAuthCode({
      email: user.email,
      code,
      purpose: "login",
      hash: user.loginCode,
    });

    if (!validCode) {
      const nextAttempts = user.loginCodeAttempts + 1;
      const invalidate = nextAttempts >= CODE_ATTEMPT_LIMIT;

      await prisma.user.update({
        where: { id: user.id },
        data: invalidate
          ? {
              loginCode: null,
              loginCodeExpiresAt: null,
              loginCodeAttempts: 0,
            }
          : {
              loginCodeAttempts: nextAttempts,
            },
      });

      return NextResponse.json(
        {
          error: invalidate
            ? "Too many invalid attempts. Request a new login code."
            : INVALID_MESSAGE,
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginCode: null,
        loginCodeExpiresAt: null,
        loginCodeAttempts: 0,
      },
    });

    await createSession(user.id);

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.emailVerified,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("login-code POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
