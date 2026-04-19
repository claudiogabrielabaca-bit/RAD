import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  createSession,
  generateNumericCode,
  hashAuthCode,
  hashPassword,
} from "@/app/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMAIL_VERIFY_TTL_MINUTES = 20;

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

async function verifyTurnstileToken(token: string) {
  if (!token) return false;

  if (process.env.NODE_ENV !== "production" && token === "local-dev-bypass") {
    return true;
  }

  const secret =
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
    "";

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
      }
    );

    const json = await res.json().catch(() => null);

    return !!json?.success;
  } catch {
    return false;
  }
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
        { status: 400 }
      );
    }

    if (!isValidUsername(username)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3 to 20 characters and use only lowercase letters, numbers, or underscores.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const turnstileOk = await verifyTurnstileToken(turnstileToken);

    if (!turnstileOk) {
      return NextResponse.json(
        { error: "Security check failed. Please try again." },
        { status: 400 }
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

    if (existing?.email === email) {
      return NextResponse.json(
        { error: "That email is already registered." },
        { status: 409 }
      );
    }

    if (existing?.username === username) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 }
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

    return NextResponse.json(
      {
        ok: true,
        message:
          "Account created successfully. You're already signed in. Verify your email when you're ready.",
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
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("register POST error:", error);

    if (isPrismaError(error, "P2002")) {
      return NextResponse.json(
        { error: "Email or username already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}