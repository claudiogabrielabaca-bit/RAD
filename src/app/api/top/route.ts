import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_MATCH_LABEL = "No exact historical match";
const EMPTY_HIGHLIGHT_TEXT = "No exact historical match was found for this date.";
const TOP_CACHE_TTL_MS = 5 * 1000;
const MIN_RANKING_VOTES = 2;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type RankedDay = {
  day: string;
  avg: number;
  count: number;
  title: string | null;
  text: string | null;
  image: string | null;
  articleUrl: string | null;
  type: string | null;
  secondaryType: string | null;
  kind: string | null;
  category: string | null;
};

type RankedTopResponse = {
  top: RankedDay[];
  low: RankedDay[];
};

type RankedAggregateRow = {
  day: string;
  avg: number | string | null;
  count: number | bigint | null;
};

type CacheRow = {
  day: string;
  type: string;
  title: string | null;
  text: string;
  image: string | null;
  articleUrl: string | null;
  highlights: unknown;
};

type HighlightLike = {
  title: string | null;
  text: string | null;
  image: string | null;
  articleUrl: string | null;
  type: string | null;
  secondaryType: string | null;
  kind: string | null;
  category: string | null;
};

let topCache:
  | {
      expiresAt: number;
      payload: RankedTopResponse;
    }
  | null = null;

let topRequestPromise: Promise<RankedTopResponse> | null = null;

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value?: string | null) {
  const text = cleanText(value);

  if (!text || text === EMPTY_HIGHLIGHT_TEXT) {
    return null;
  }

  return text;
}

function typeToKind(type?: string | null) {
  switch (type) {
    case "selected":
      return "selected";
    case "births":
    case "birth":
      return "birth";
    case "deaths":
    case "death":
      return "death";
    case "none":
      return "none";
    default:
      return type ? "event" : null;
  }
}

function typeToCategory(type?: string | null) {
  switch (type) {
    case "war":
    case "disaster":
    case "politics":
    case "science":
    case "culture":
    case "sports":
    case "discovery":
    case "crime":
      return type;
    default:
      return "general";
  }
}

function readHighlightLike(value: unknown): HighlightLike | null {
  if (!isRecord(value)) return null;

  return {
    title: safeString(value.title),
    text: safeString(value.text),
    image: safeString(value.image),
    articleUrl: safeString(value.articleUrl),
    type: safeString(value.type),
    secondaryType: safeString(value.secondaryType),
    kind: safeString(value.kind),
    category: safeString(value.category),
  };
}

function readPrimaryHighlightFromJson(value: unknown): HighlightLike | null {
  if (Array.isArray(value)) {
    const items = value
      .map(readHighlightLike)
      .filter((item): item is HighlightLike => !!item);

    return (
      items.find(
        (item) =>
          item.type !== "none" &&
          !!cleanText(item.title) &&
          !!normalizeText(item.text)
      ) ??
      items.find((item) => !!cleanText(item.title)) ??
      items[0] ??
      null
    );
  }

  return readHighlightLike(value);
}

function buildContextFromCacheRow(row?: CacheRow): Omit<
  RankedDay,
  "day" | "avg" | "count"
> {
  if (!row) {
    return {
      title: NO_MATCH_LABEL,
      text: null,
      image: null,
      articleUrl: null,
      type: null,
      secondaryType: null,
      kind: null,
      category: null,
    };
  }

  const primary = readPrimaryHighlightFromJson(row.highlights);

  const type = cleanText(primary?.type) || row.type || null;
  const secondaryType = cleanText(primary?.secondaryType) || null;
  const kind = cleanText(primary?.kind) || typeToKind(type);
  const category = cleanText(primary?.category) || typeToCategory(type);

  const title =
    cleanText(primary?.title) ||
    cleanText(row.title) ||
    (row.type === "none" ? NO_MATCH_LABEL : NO_MATCH_LABEL);

  const text = normalizeText(primary?.text) ?? normalizeText(row.text);

  return {
    title,
    text,
    image: cleanText(primary?.image) || cleanText(row.image) || null,
    articleUrl:
      cleanText(primary?.articleUrl) || cleanText(row.articleUrl) || null,
    type,
    secondaryType,
    kind,
    category,
  };
}

function toSafeNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toSafeInteger(value: number | bigint | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  return 0;
}

function normalizeRankedRows(rows: RankedAggregateRow[]) {
  return rows.map((row) => ({
    day: row.day,
    avg: toSafeNumber(row.avg),
    count: toSafeInteger(row.count),
  }));
}

async function getTopRatingGroups() {
  const rows = await prisma.$queryRaw<RankedAggregateRow[]>`
    SELECT
      "day",
      "avgStars" AS "avg",
      "ratingsCount" AS "count"
    FROM "DayRatingAggregate"
    WHERE "ratingsCount" >= ${MIN_RANKING_VOTES}
    ORDER BY "avgStars" DESC, "ratingsCount" DESC
    LIMIT 10
  `;

  return normalizeRankedRows(rows);
}

async function getLowestRatingGroups() {
  const rows = await prisma.$queryRaw<RankedAggregateRow[]>`
    SELECT
      "day",
      "avgStars" AS "avg",
      "ratingsCount" AS "count"
    FROM "DayRatingAggregate"
    WHERE "ratingsCount" >= ${MIN_RANKING_VOTES}
    ORDER BY "avgStars" ASC, "ratingsCount" DESC
    LIMIT 10
  `;

  return normalizeRankedRows(rows);
}

async function buildContextMap(days: string[]) {
  const uniqueDays = Array.from(new Set(days));

  if (uniqueDays.length === 0) {
    return new Map<string, CacheRow>();
  }

  const rows: CacheRow[] = await prisma.dayHighlightCache.findMany({
    where: {
      day: {
        in: uniqueDays,
      },
    },
    select: {
      day: true,
      type: true,
      title: true,
      text: true,
      image: true,
      articleUrl: true,
      highlights: true,
    },
  });

  return new Map<string, CacheRow>(rows.map((row) => [row.day, row]));
}

function attachContext(
  items: Array<{ day: string; avg: number; count: number }>,
  cacheByDay: Map<string, CacheRow>
): RankedDay[] {
  return items.map((item) => ({
    ...item,
    ...buildContextFromCacheRow(cacheByDay.get(item.day)),
  }));
}

async function buildTopPayload(): Promise<RankedTopResponse> {
  const [sortedTop, sortedLow] = await Promise.all([
    getTopRatingGroups(),
    getLowestRatingGroups(),
  ]);

  const cacheByDay = await buildContextMap([
    ...sortedTop.map((item) => item.day),
    ...sortedLow.map((item) => item.day),
  ]);

  return {
    top: attachContext(sortedTop, cacheByDay),
    low: attachContext(sortedLow, cacheByDay),
  };
}

async function getCachedTopPayload() {
  const now = Date.now();

  if (topCache && topCache.expiresAt > now) {
    return topCache.payload;
  }

  if (topRequestPromise) {
    return topRequestPromise;
  }

  topRequestPromise = buildTopPayload()
    .then((payload) => {
      topCache = {
        payload,
        expiresAt: Date.now() + TOP_CACHE_TTL_MS,
      };

      return payload;
    })
    .finally(() => {
      topRequestPromise = null;
    });

  return topRequestPromise;
}

export async function GET(req: Request) {
  try {
    const rateLimit = await consumeRateLimit({
      action: "top",
      key: buildRateLimitKey(req, "public"),
      limit: 240,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many ranking requests. Please try again later."
      );
    }

    const payload = await getCachedTopPayload();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("top GET error:", error);

    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}

