import { NextResponse } from "next/server";
import {
  getAdminCookieName,
  getExpectedAdminPassword,
  getExpectedAdminUsername,
} from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const username = body?.username;
    const password = body?.password;

    const expectedUser = getExpectedAdminUsername();
    const expectedPass = getExpectedAdminPassword();

    if (!expectedUser || !expectedPass) {
      return NextResponse.json(
        { error: "Admin credentials are not configured" },
        { status: 500 }
      );
    }

    if (username !== expectedUser || password !== expectedPass) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const res = NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    res.cookies.set({
      name: getAdminCookieName(),
      value: `${expectedUser}:${expectedPass}`,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (error) {
    console.error("admin login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}