import { NextResponse } from "next/server";
import {
  type DayStatsSummary,
  getDayStatsMap,
  normalizeStatsDayList,
} from "@/app/lib/day-stats";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BATCH_DAYS = 120;
const MAX_RAW_BATCH_DAYS = 240;
const DAY_STATS_CACHE_TTL_MS = 60 * 1000;
const MAX_DAY_STATS_CACHE_ENTRIES = 500;

type DayStatsBatchPayload = {
  stats: Record<string, DayStatsSummary>;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const CACHE_HEADERS = {
  "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
};

const dayStatsCache = new Map<
  string,
  {
    expiresAt: number;
    payload: DayStatsBatchPayload;
  }
>();

const dayStatsRequests = new Map<string, Promise<DayStatsBatchPayload>>();

function buildStatsCacheKey(days: string[]) {
  return [...days].sort().join(",");
}

function sweepExpiredDayStatsCache() {
  const now = Date.now();

  for (const [key, entry] of dayStatsCache.entries()) {
    if (entry.expiresAt <= now) {
      dayStatsCache.delete(key);
    }
  }

  if (dayStatsCache.size <= MAX_DAY_STATS_CACHE_ENTRIES) {
    return;
  }

  const overflow = dayStatsCache.size - MAX_DAY_STATS_CACHE_ENTRIES;
  let removed = 0;

  for (const key of dayStatsCache.keys()) {
    dayStatsCache.delete(key);
    removed += 1;

    if (removed >= overflow) {
      break;
    }
  }
}

async function buildDayStatsPayload(days: string[]): Promise<DayStatsBatchPayload> {
  return {
    stats: await getDayStatsMap(days),
  };
}

async function getCachedDayStatsPayload(days: string[]) {
  const key = buildStatsCacheKey(days);
  const now = Date.now();

  const cached = dayStatsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const pending = dayStatsRequests.get(key);
  if (pending) {
    return pending;
  }

  const request = buildDayStatsPayload(days)
    .then((payload) => {
      dayStatsCache.set(key, {
        payload,
        expiresAt: Date.now() + DAY_STATS_CACHE_TTL_MS,
      });

      sweepExpiredDayStatsCache();

      return payload;
    })
    .finally(() => {
      dayStatsRequests.delete(key);
    });

  dayStatsRequests.set(key, request);

  return request;
}

export async function POST(req: Request) {
  try {
    const rateLimit = await consumeRateLimit({
      action: "day-stats-batch",
      key: buildRateLimitKey(req, "public"),
      limit: 240,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many stats requests. Please try again later."
      );
    }

    const body = await req.json().catch(() => null);
    const rawDays = Array.isArray(body?.days) ? body.days : [];

    if (rawDays.length > MAX_RAW_BATCH_DAYS) {
      return NextResponse.json(
        { error: "Too many days requested. Max 120 days." },
        {
          status: 400,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const days = normalizeStatsDayList(rawDays).slice(0, MAX_BATCH_DAYS);

    if (days.length === 0) {
      return NextResponse.json(
        { stats: {} },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const payload = await getCachedDayStatsPayload(days);

    return NextResponse.json(payload, {
      headers: CACHE_HEADERS,
    });
  } catch (error) {
    console.error("day-stats-batch POST error:", error);

    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
