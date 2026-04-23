import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";
import { createSession, verifyAuthCode } from "@/app/lib/auth";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PENDING_LOGIN_COOKIE = "rad_pending_login_email";
const CODE_ATTEMPT_LIMIT = 5;
const INVALID_MESSAGE = "Invalid or expired login code.";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function getPendingLoginEmail() {
  const store = await cookies();
  const value = store.get(PENDING_LOGIN_COOKIE)?.value ?? "";
  return normalizeEmail(value);
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
    const code = body?.code?.toString().trim() ?? "";
    const email = await getPendingLoginEmail();

    if (!email) {
      return NextResponse.json(
        { error: "Start the login flow again." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: INVALID_MESSAGE },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "login-code",
      key: buildRateLimitKey(req, email),
      limit: 12,
      windowMs: 15 * 60 * 1000,
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
        createdAt: true,
        loginCode: true,
        loginCodeExpiresAt: true,
        loginCodeAttempts: true,
      },
    });

    if (!user || !user.emailVerified) {
      await clearPendingLoginEmailCookie();

      return NextResponse.json(
        { error: "Start the login flow again." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!user.loginCode || !user.loginCodeExpiresAt) {
      await clearPendingLoginEmailCookie();

      return NextResponse.json(
        { error: INVALID_MESSAGE },
        { status: 400, headers: NO_STORE_HEADERS }
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

      await clearPendingLoginEmailCookie();

      return NextResponse.json(
        { error: INVALID_MESSAGE },
        { status: 400, headers: NO_STORE_HEADERS }
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

      await clearPendingLoginEmailCookie();

      return NextResponse.json(
        { error: "Too many invalid attempts. Request a new code." },
        { status: 400, headers: NO_STORE_HEADERS }
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

      if (invalidate) {
        await clearPendingLoginEmailCookie();
      }

      return NextResponse.json(
        {
          error: invalidate
            ? "Too many invalid attempts. Request a new code."
            : INVALID_MESSAGE,
        },
        { status: 400, headers: NO_STORE_HEADERS }
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
    await clearPendingLoginEmailCookie();

    return NextResponse.json(
      {
        ok: true,
        message: "Logged in successfully.",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt.toISOString(),
        },
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("login-code POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}