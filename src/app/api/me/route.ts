import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const ME_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const ME_RATE_LIMIT_LIMIT = 300;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();

    const rateLimit = await consumeRateLimit({
      action: "me",
      key: buildRateLimitKey(req, user?.id ?? "visitor"),
      limit: ME_RATE_LIMIT_LIMIT,
      windowMs: ME_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many session requests. Please try again later."
      );
    }

    return NextResponse.json(
      {
        user: user
          ? {
              id: user.id,
              email: user.email,
              username: user.username,
              emailVerified: user.emailVerified,
              createdAt: user.createdAt.toISOString(),
            }
          : null,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("me GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
