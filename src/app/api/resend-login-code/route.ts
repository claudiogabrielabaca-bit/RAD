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

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
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

    if (!user) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Verify your email before requesting a login code." },
        { status: 403 }
      );
    }

    const loginCode = generateNumericCode(6);
    const loginCodeExpiresAt = new Date(Date.now() + 1000 * 60 * 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginCode,
        loginCodeExpiresAt,
      },
    });

    let emailSent = false;

    try {
      const mailResult = await sendMail({
        to: user.email,
        subject: "Your RAD login code",
        text: `Hello ${user.username},

Your login code is: ${loginCode}

This code expires in 10 minutes.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2>RAD login code</h2>
            <p>Hello <strong>${user.username}</strong>,</p>
            <p>Your login code is:</p>
            <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">
              ${loginCode}
            </div>
            <p>This code expires in <strong>10 minutes</strong>.</p>
          </div>
        `,
      });

      console.log("resend-login-code email sent:", mailResult?.id);
      emailSent = true;
    } catch (mailError) {
      console.error("resend-login-code mail send error:", mailError);
    }

    return NextResponse.json({
      ok: true,
      emailSent,
      message: emailSent
        ? "New login code sent."
        : "New login code generated, but the email could not be sent.",
      devCode: process.env.NODE_ENV !== "production" ? loginCode : undefined,
    });
  } catch (error) {
    console.error("resend-login-code POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}