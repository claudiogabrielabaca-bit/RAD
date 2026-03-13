import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { generateNumericCode, verifyPassword } from "@/app/lib/auth";

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

      return NextResponse.json(
        {
          error: "Verify your email before logging in.",
          requiresVerification: true,
          email: user.email,
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

    return NextResponse.json(
      {
        ok: true,
        requiresCode: true,
        email: user.email,
        message: "Login code generated. Enter it to access your account.",
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