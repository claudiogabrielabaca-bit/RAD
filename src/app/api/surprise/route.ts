import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { getNextSurpriseDay } from "@/app/lib/surprise-deck";
import { buildDayBundle } from "@/app/lib/day-bundle";
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

const SURPRISE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SURPRISE_RATE_LIMIT_LIMIT = 60;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();

    const rateLimit = await consumeRateLimit({
      action: "surprise",
      key: buildRateLimitKey(req, user?.id ?? "visitor"),
      limit: SURPRISE_RATE_LIMIT_LIMIT,
      windowMs: SURPRISE_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many surprise requests. Please try again later."
      );
    }

    const result = await getNextSurpriseDay({
      userId: user?.id ?? null,
    });

    if (!result) {
      return NextResponse.json(
        { error: "No valid surprise day found." },
        {
          status: 404,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const bundle = await buildDayBundle(result.day);

    return NextResponse.json(
      {
        ...bundle,
        source: result.source,
        remaining: result.remaining,
        total: result.total,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("surprise GET error:", error);

    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
