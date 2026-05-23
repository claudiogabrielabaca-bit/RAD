import { NextResponse } from "next/server";
import { buildPickDateBundle } from "@/app/lib/pick-date-bundle";
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

const PICK_DATE_BUNDLE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const PICK_DATE_BUNDLE_RATE_LIMIT_LIMIT = 120;

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
      action: "pick-date-bundle",
      key: buildRateLimitKey(req),
      limit: PICK_DATE_BUNDLE_RATE_LIMIT_LIMIT,
      windowMs: PICK_DATE_BUNDLE_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many date requests. Please try again later."
      );
    }

    const payload = await buildPickDateBundle(day);

    return NextResponse.json(payload, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("pick-date-bundle GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
