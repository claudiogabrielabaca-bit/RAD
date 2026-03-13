import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { generateNumericCode, hashPassword } from "@/app/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const username = body?.username?.toString().trim().toLowerCase();
    const password = body?.password?.toString() ?? "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    if (!username || username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: "Username must be between 3 and 20 characters." },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username can only contain lowercase letters, numbers and underscores.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email already in use." },
        { status: 409 }
      );
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already taken." },
        { status: 409 }
      );
    }

    const verifyCode = generateNumericCode(6);
    const verifyExpiresAt = new Date(Date.now() + 1000 * 60 * 15);
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        emailVerified: false,
        emailVerifyCode: verifyCode,
        emailVerifyExpiresAt: verifyExpiresAt,
      },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        user,
        message: "Account created. Verify your email before logging in.",
        devCode: process.env.NODE_ENV !== "production" ? verifyCode : undefined,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("register POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}