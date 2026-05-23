import { NextResponse } from "next/server";
import { buildDayBundle, buildDayCommunityBundle } from "@/app/lib/day-bundle";
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

const DAY_BUNDLE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DAY_BUNDLE_RATE_LIMIT_LIMIT = 180;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day");
    const communityOnly = searchParams.get("communityOnly") === "1";

    if (!isValidDayString(day)) {
      return NextResponse.json(
        { error: "Invalid day" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: communityOnly ? "day-bundle-community" : "day-bundle",
      key: buildRateLimitKey(req),
      limit: DAY_BUNDLE_RATE_LIMIT_LIMIT,
      windowMs: DAY_BUNDLE_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many day bundle requests. Please try again later."
      );
    }

    const payload = communityOnly
      ? await buildDayCommunityBundle(day)
      : await buildDayBundle(day);

    return NextResponse.json(payload, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("day-bundle GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
