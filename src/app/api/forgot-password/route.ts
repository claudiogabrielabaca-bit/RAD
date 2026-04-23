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

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = body?.email?.toString().trim().toLowerCase();
    const turnstileToken = body?.turnstileToken?.toString() ?? "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "forgot-password",
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
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    let devCode: string | undefined;

    if (user) {
      const resetCode = generateNumericCode(6);
      const resetCodeHash = hashAuthCode({
        email: user.email,
        code: resetCode,
        purpose: "reset",
      });
      const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 15);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetCode: resetCodeHash,
          passwordResetExpiresAt: resetExpiresAt,
          passwordResetAttempts: 0,
        },
      });

      devCode =
        process.env.NODE_ENV !== "production" ? resetCode : undefined;

      try {
        const mailResult = await sendMail({
          to: user.email,
          subject: "Your RAD password reset code",
          text: `Hello ${user.username},

Your password reset code is: ${resetCode}

This code expires in 15 minutes.`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
              <h2>RAD password reset</h2>
              <p>Hello <strong>${user.username}</strong>,</p>
              <p>Your reset code is:</p>
              <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">
                ${resetCode}
              </div>
              <p>This code expires in <strong>15 minutes</strong>.</p>
            </div>
          `,
        });

        console.log("forgot-password email sent:", mailResult?.id);
      } catch (mailError) {
        console.error("forgot-password mail send error:", mailError);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        message: "If that email exists, a recovery code was sent.",
        devCode,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("forgot-password POST error:", error);
    return NextResponse.json(
      { error: "Server error." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}