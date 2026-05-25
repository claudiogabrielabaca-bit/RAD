import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

function ensureIncludes(path, needle, message) {
  const source = read(path);
  if (!source.includes(needle)) {
    throw new Error(`${path}: ${message}`);
  }
}

function addSchemaModel() {
  const path = "prisma/schema.prisma";
  let source = read(path);

  if (source.includes("model DayRatingAggregate")) {
    console.log("DayRatingAggregate model already present.");
    return;
  }

  const model = `
model DayRatingAggregate {
  day          String   @id
  ratingsCount Int     @default(0)
  starsSum     Int     @default(0)
  avgStars     Float   @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([ratingsCount, avgStars], name: "day_rating_aggregate_top_idx")
  @@index([avgStars, ratingsCount], name: "day_rating_aggregate_avg_count_idx")
}
`;

  const anchor = "\nmodel RateLimit {";
  if (!source.includes(anchor)) {
    throw new Error("Could not find RateLimit model anchor in prisma/schema.prisma");
  }

  source = source.replace(anchor, `${model}${anchor}`);
  write(path, source);
  console.log("Added DayRatingAggregate model to prisma/schema.prisma.");
}

function overwriteTopRoute() {
  const path = "src/app/api/top/route.ts";
  const source = `import { prisma } from "@/app/lib/prisma";
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
const TOP_CACHE_TTL_MS = 60 * 1000;
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
  return value?.replace(/\\s+/g, " ").trim() || "";
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
  const rows = await prisma.$queryRaw<RankedAggregateRow[]>\`
    SELECT
      "day",
      "avgStars" AS "avg",
      "ratingsCount" AS "count"
    FROM "DayRatingAggregate"
    WHERE "ratingsCount" >= \${MIN_RANKING_VOTES}
    ORDER BY "avgStars" DESC, "ratingsCount" DESC
    LIMIT 10
  \`;

  return normalizeRankedRows(rows);
}

async function getLowestRatingGroups() {
  const rows = await prisma.$queryRaw<RankedAggregateRow[]>\`
    SELECT
      "day",
      "avgStars" AS "avg",
      "ratingsCount" AS "count"
    FROM "DayRatingAggregate"
    WHERE "ratingsCount" >= \${MIN_RANKING_VOTES}
    ORDER BY "avgStars" ASC, "ratingsCount" DESC
    LIMIT 10
  \`;

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
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
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
`;

  write(path, source);
  console.log("Rewrote src/app/api/top/route.ts to use DayRatingAggregate.");
}

function addAggregateImport(path) {
  let source = read(path);
  if (source.includes("@/app/lib/rating-aggregates")) return;

  const anchor = 'import { prisma } from "@/app/lib/prisma";';
  if (!source.includes(anchor)) {
    throw new Error(`${path}: could not find prisma import anchor`);
  }

  source = source.replace(
    anchor,
    `${anchor}\nimport { refreshDayRatingAggregate } from "@/app/lib/rating-aggregates";`
  );

  write(path, source);
}

function patchRateRoute() {
  const path = "src/app/api/rate/route.ts";
  addAggregateImport(path);

  let source = read(path);
  if (source.includes("await refreshDayRatingAggregate(day);")) {
    console.log("Rate route aggregate refresh already present.");
    return;
  }

  const pattern = /(    await prisma\.rating\.upsert\(\{[\s\S]*?\n    \}\);\n)(\n    return NextResponse\.json)/;
  if (!pattern.test(source)) {
    throw new Error("Could not find rating upsert block in src/app/api/rate/route.ts");
  }

  source = source.replace(
    pattern,
    `$1\n    await refreshDayRatingAggregate(day);\n$2`
  );

  write(path, source);
  console.log("Patched src/app/api/rate/route.ts to refresh DayRatingAggregate.");
}

function patchReviewDeleteRoute() {
  const path = "src/app/api/review-delete/route.ts";
  addAggregateImport(path);

  let source = read(path);

  source = source.replace(
    /select:\s*\{\s*id:\s*true,\s*userId:\s*true,\s*\}/,
    `select: {\n        id: true,\n        day: true,\n        userId: true,\n      }`
  );

  if (!source.includes("await refreshDayRatingAggregate(review.day);")) {
    const anchor = `    await prisma.rating.delete({
      where: { id: ratingId },
    });`;

    if (!source.includes(anchor)) {
      throw new Error("Could not find rating delete block in src/app/api/review-delete/route.ts");
    }

    source = source.replace(
      anchor,
      `${anchor}\n\n    await refreshDayRatingAggregate(review.day);`
    );
  }

  write(path, source);
  console.log("Patched src/app/api/review-delete/route.ts to refresh DayRatingAggregate.");
}

function patchAdminDeleteReviewRoute() {
  const path = "src/app/api/admin/delete-review/route.ts";
  addAggregateImport(path);

  let source = read(path);

  if (!source.includes("await refreshDayRatingAggregate(rating.day);")) {
    const anchor = `    await prisma.rating.delete({
      where: { id: ratingId },
    });`;

    if (!source.includes(anchor)) {
      throw new Error("Could not find rating delete block in src/app/api/admin/delete-review/route.ts");
    }

    source = source.replace(
      anchor,
      `${anchor}\n\n    await refreshDayRatingAggregate(rating.day);`
    );
  }

  write(path, source);
  console.log("Patched src/app/api/admin/delete-review/route.ts to refresh DayRatingAggregate.");
}

addSchemaModel();
overwriteTopRoute();
patchRateRoute();
patchReviewDeleteRoute();
patchAdminDeleteReviewRoute();

ensureIncludes("prisma/schema.prisma", "model DayRatingAggregate", "missing aggregate model");
ensureIncludes("src/app/api/top/route.ts", 'FROM "DayRatingAggregate"', "top route must query aggregate table");
ensureIncludes("src/app/api/rate/route.ts", "refreshDayRatingAggregate(day)", "rate route must refresh aggregate");
ensureIncludes("src/app/api/review-delete/route.ts", "refreshDayRatingAggregate(review.day)", "review delete route must refresh aggregate");
ensureIncludes("src/app/api/admin/delete-review/route.ts", "refreshDayRatingAggregate(rating.day)", "admin delete route must refresh aggregate");

console.log("Top ranking aggregate patch applied.");
