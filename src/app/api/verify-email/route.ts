import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const code = body?.code?.toString().trim();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        emailVerifyCode: true,
        emailVerifyExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        ok: true,
        message: "Your email is already verified.",
      });
    }

    if (!user.emailVerifyCode || !user.emailVerifyExpiresAt) {
      return NextResponse.json(
        { error: "No active verification code found." },
        { status: 400 }
      );
    }

    if (user.emailVerifyExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "Verification code expired. Request a new one." },
        { status: 400 }
      );
    }

    if (user.emailVerifyCode !== code) {
      return NextResponse.json(
        { error: "Invalid verification code." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyCode: null,
        emailVerifyExpiresAt: null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Email verified successfully. Now you can log in.",
    });
  } catch (error) {
    console.error("verify-email POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}