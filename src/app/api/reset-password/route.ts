import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { hashPassword } from "@/app/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const code = body?.code?.toString().trim();
    const newPassword = body?.newPassword?.toString() ?? "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Invalid reset code." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordResetCode: true,
        passwordResetExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or reset code." },
        { status: 400 }
      );
    }

    if (!user.passwordResetCode || !user.passwordResetExpiresAt) {
      return NextResponse.json(
        { error: "No reset code found." },
        { status: 400 }
      );
    }

    if (user.passwordResetExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "Reset code expired." },
        { status: 400 }
      );
    }

    if (user.passwordResetCode !== code) {
      return NextResponse.json(
        { error: "Invalid email or reset code." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        passwordResetCode: null,
        passwordResetExpiresAt: null,
      },
    });

    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Password updated successfully. Please log in again.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("reset-password POST error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}