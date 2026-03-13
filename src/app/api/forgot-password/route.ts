import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { generateNumericCode } from "@/app/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = body?.email?.toString().trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        {
          error: "Invalid email.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    });

    if (user) {
      const resetCode = generateNumericCode(6);
      const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 15);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetCode: resetCode,
          passwordResetExpiresAt: resetExpiresAt,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          message:
            "If that email exists, a recovery code was generated. Email sending is not connected yet.",
          devCode: resetCode,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          "If that email exists, a recovery code was generated. Email sending is not connected yet.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("forgot-password POST error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}