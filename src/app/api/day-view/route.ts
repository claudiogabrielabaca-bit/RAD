import { prisma } from "@/app/lib/prisma";
import { isValidDayString } from "@/app/lib/day";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
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

const DAY_VIEW_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DAY_VIEW_RATE_LIMIT_LIMIT = 180;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const day = body?.day;

    if (!isValidDayString(day)) {
      return NextResponse.json(
        { error: "Invalid day" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "day-view",
      key: buildRateLimitKey(req),
      limit: DAY_VIEW_RATE_LIMIT_LIMIT,
      windowMs: DAY_VIEW_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many day view requests. Please try again later."
      );
    }

    await prisma.$executeRaw`
      INSERT INTO "DayStats" ("id", "day", "views", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${day}, 1, NOW(), NOW())
      ON CONFLICT ("day")
      DO UPDATE SET
        "views" = "DayStats"."views" + 1,
        "updatedAt" = NOW()
    `;

    return new NextResponse(null, {
      status: 204,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("day-view POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
