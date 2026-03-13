import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { createSession } from "@/app/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const email = body?.email?.toString().trim().toLowerCase();
    const code = body?.code?.toString().trim();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and login code are required." },
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
        loginCode: true,
        loginCodeExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid login code." },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Verify your email before logging in." },
        { status: 403 }
      );
    }

    if (!user.loginCode || !user.loginCodeExpiresAt) {
      return NextResponse.json(
        { error: "No active login code found." },
        { status: 400 }
      );
    }

    if (user.loginCodeExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "Login code expired. Request a new one." },
        { status: 400 }
      );
    }

    if (user.loginCode !== code) {
      return NextResponse.json(
        { error: "Invalid login code." },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginCode: null,
        loginCodeExpiresAt: null,
      },
    });

    await createSession(user.id);

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.emailVerified,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("login-code POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}