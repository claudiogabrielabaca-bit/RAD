import { NextResponse } from "next/server";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";
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

export async function GET(req: Request) {
  try {
    const rateLimit = await consumeRateLimit({
      action: "highlight",
      key: buildRateLimitKey(req, "public"),
      limit: 180,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many highlight requests. Please try again later."
      );
    }

    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day");

    if (!isValidDayString(day)) {
      return NextResponse.json(
        { error: "Invalid day" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const result = await ensureHighlightsForDay(day);

    return NextResponse.json(
      {
        highlight: result.highlight,
        highlights: result.highlights,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("highlight GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
