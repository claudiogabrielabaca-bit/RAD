import { NextResponse } from "next/server";
import { getRandomValidDay } from "@/app/lib/random-valid-day";
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

const RANDOM_VALID_DAY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RANDOM_VALID_DAY_RATE_LIMIT_LIMIT = 120;

function parseExcludeDays(searchParams: URLSearchParams) {
  const raw = searchParams.get("excludeDays") ?? "";

  if (!raw.trim()) return [];

  return Array.from(
    new Set(raw.split(",").map((item) => item.trim()).filter(isValidDayString))
  ).slice(0, 30);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get("fresh") === "1";
    const excludeDays = parseExcludeDays(searchParams);

    const rateLimit = await consumeRateLimit({
      action: "random-valid-day",
      key: buildRateLimitKey(req),
      limit: RANDOM_VALID_DAY_RATE_LIMIT_LIMIT,
      windowMs: RANDOM_VALID_DAY_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many random day requests. Please try again later."
      );
    }

    const result = await getRandomValidDay({
      fresh,
      maxAttempts: 12,
      excludeDays,
    });

    if (!result) {
      return NextResponse.json(
        { error: "No valid random day found." },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(result, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("random-valid-day GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
