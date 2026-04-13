import { NextResponse } from "next/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";
import {
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const username = body?.username?.toString().trim() ?? "";
    const password = body?.password?.toString() ?? "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const rateLimitKey = buildRateLimitKey(req, username);

    const rateLimit = await consumeRateLimit({
      action: "admin-login",
      key: rateLimitKey,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many admin login attempts. Please try again later."
      );
    }

    const validCredentials = await verifyAdminCredentials({
      username,
      password,
    });

    if (!validCredentials) {
      return NextResponse.json(
        { error: "Invalid admin credentials." },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
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

    await setAdminSessionCookie(res);

    return res;
  } catch (error) {
    console.error("admin login POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}