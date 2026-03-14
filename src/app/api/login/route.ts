import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { generateNumericCode, verifyPassword } from "@/app/lib/auth";
import { sendMail } from "@/app/lib/mail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const password = body?.password?.toString() ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
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

        console.log("login verification email sent:", mailResult?.id);
        emailSent = true;
      } catch (mailError) {
        console.error("login verification mail send error:", mailError);
      }

      return NextResponse.json(
        {
          error: emailSent
            ? "Verify your email before logging in."
            : "Verify your email before logging in. We could not send the verification email.",
          requiresVerification: true,
          email: user.email,
          emailSent,
          devCode:
            process.env.NODE_ENV !== "production" ? verifyCode : undefined,
        },
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

      console.log("login code email sent:", mailResult?.id);
      emailSent = true;
    } catch (mailError) {
      console.error("login code mail send error:", mailError);
    }

    return NextResponse.json(
      {
        ok: true,
        requiresCode: true,
        email: user.email,
        emailSent,
        message: emailSent
          ? "Login code sent. Enter it to access your account."
          : "Login code generated, but the email could not be sent.",
        devCode: process.env.NODE_ENV !== "production" ? loginCode : undefined,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("login POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}