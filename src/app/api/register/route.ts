import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import {
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const username = body?.username?.toString().trim().toLowerCase();
    const password = body?.password?.toString() ?? "";
    const turnstileToken = body?.turnstileToken?.toString() ?? "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const rateLimit = await consumeRateLimit({
      action: "register",
      key: buildRateLimitKey(req, email),
      limit: 4,
      windowMs: 60 * 60 * 1000,
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
        { status: 400 }
      );
    }

    if (!username || username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: "Username must be between 3 and 20 characters." },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username can only contain lowercase letters, numbers and underscores.",
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

    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email already in use." },
        { status: 409 }
      );
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already taken." },
        { status: 409 }
      );
    }

    const verifyCode = generateNumericCode(6);
    const verifyCodeHash = hashAuthCode({
      email,
      code: verifyCode,
      purpose: "verify",
    });
    const verifyExpiresAt = new Date(Date.now() + 1000 * 60 * 15);
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        emailVerified: false,
        emailVerifyCode: verifyCodeHash,
        emailVerifyExpiresAt: verifyExpiresAt,
        emailVerifyAttempts: 0,
      },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
      },
    });

    let emailSent = false;

    try {
      const mailResult = await sendMail({
        to: email,
        subject: "Verify your RAD account",
        text: `Welcome to RAD!

Your verification code is: ${verifyCode}

This code expires in 15 minutes.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2>Welcome to RAD</h2>
            <p>Your verification code is:</p>
            <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">
              ${verifyCode}
            </div>
            <p>This code expires in <strong>15 minutes</strong>.</p>
            <p>You can enter it in the verification screen to activate your account.</p>
          </div>
        `,
      });

      console.log("register verification email sent:", mailResult?.id);
      emailSent = true;
    } catch (mailError) {
      console.error("register mail send error:", mailError);
    }

    return NextResponse.json(
      {
        ok: true,
        user,
        emailSent,
        message: emailSent
          ? "Account created. Check your email to verify your account."
          : "Account created, but we could not send the verification email. Request a new code.",
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
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}