import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { generateNumericCode } from "@/app/lib/auth";

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
        message: "This email is already verified.",
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

    return NextResponse.json({
      ok: true,
      message: "Verification code regenerated.",
      devCode: process.env.NODE_ENV !== "production" ? verifyCode : undefined,
    });
  } catch (error) {
    console.error("resend-verification POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}