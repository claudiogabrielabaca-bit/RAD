import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { setAdminSessionCookie } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(req: Request) {
  try {
    const adminUsername = process.env.ADMIN_USERNAME ?? "";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "";
    const adminSecret = process.env.ADMIN_SECRET ?? "";

    if (!adminUsername || !adminPassword || !adminSecret) {
      return NextResponse.json(
        { error: "Admin environment variables are missing." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);

    const username = body?.username?.toString().trim() ?? "";
    const password = body?.password?.toString() ?? "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const validUsername = safeEqual(username, adminUsername);
    const validPassword = safeEqual(password, adminPassword);

    if (!validUsername || !validPassword) {
      return NextResponse.json(
        { error: "Invalid admin credentials." },
        { status: 401 }
      );
    }

    const res = NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    setAdminSessionCookie(res);

    return res;
  } catch (error) {
    console.error("admin login POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
