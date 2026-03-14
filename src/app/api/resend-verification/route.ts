import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { generateNumericCode, hashAuthCode } from "@/app/lib/auth";
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
    const turnstileToken = body?.turnstileToken?.toString() ?? "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const rateLimit = await consumeRateLimit({
      action: "resend-verification",
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
        emailVerified: true,
      },
    });

    let devCode: string | undefined;

    if (user && !user.emailVerified) {
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

      devCode =
        process.env.NODE_ENV !== "production" ? verifyCode : undefined;

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

        console.log("resend-verification email sent:", mailResult?.id);
      } catch (mailError) {
        console.error("resend-verification mail send error:", mailError);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        message: "If the email can receive verification, a code was sent.",
        devCode,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("resend-verification POST error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}