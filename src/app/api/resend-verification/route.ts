import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { generateNumericCode } from "@/app/lib/auth";
import { sendMail } from "@/app/lib/mail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = body?.email?.toString().trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
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

    if (!user) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json({
        ok: true,
        emailSent: false,
        message: "Your email is already verified.",
      });
    }

    const verifyCode = generateNumericCode(6);
    const verifyExpiresAt = new Date(Date.now() + 1000 * 60 * 15);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyCode: verifyCode,
        emailVerifyExpiresAt: verifyExpiresAt,
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

      console.log("resend-verification email sent:", mailResult?.id);
      emailSent = true;
    } catch (mailError) {
      console.error("resend-verification mail send error:", mailError);
    }

    return NextResponse.json({
      ok: true,
      emailSent,
      message: emailSent
        ? "Verification code sent."
        : "Verification code generated, but the email could not be sent.",
      devCode: process.env.NODE_ENV !== "production" ? verifyCode : undefined,
    });
  } catch (error) {
    console.error("resend-verification POST error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}