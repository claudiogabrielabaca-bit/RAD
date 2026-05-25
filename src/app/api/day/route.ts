import { NextResponse } from "next/server";
import { buildDayCommunityBundle } from "@/app/lib/day-bundle";
import { isValidDayString } from "@/app/lib/day";
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

const LEGACY_DAY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LEGACY_DAY_RATE_LIMIT_LIMIT = 120;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day");

    if (!isValidDayString(day)) {
      return NextResponse.json(
        { error: "Invalid day" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "day-legacy",
      key: buildRateLimitKey(req),
      limit: LEGACY_DAY_RATE_LIMIT_LIMIT,
      windowMs: LEGACY_DAY_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many day requests. Please try again later."
      );
    }

    const payload = await buildDayCommunityBundle(day);

    return NextResponse.json(payload.dayData, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("day GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
