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

    return NextResponse.json({
      ok: true,
      message: "New login code generated.",
      devCode: process.env.NODE_ENV !== "production" ? loginCode : undefined,
    });
  } catch (error) {
    console.error("resend-login-code POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}