import { prisma } from "@/app/lib/prisma";
import { getFeaturedMoment } from "@/app/lib/featured-moments";
import { getDayHighlightsLookup } from "@/app/lib/wiki";
import type { HighlightItem, HighlightResponse } from "@/app/lib/rad-types";

export const PICK_DATE_EMPTY_TEXT =
  "No exact historical match was found for this date.";

export const PICK_DATE_CACHE_VERSION = "v1-pick-date-cache";

export type PickDateCacheStatus = "ready" | "no_match" | "failed";

export type PickDateCacheEntry = {
  day: string;
  status: PickDateCacheStatus;
  type: string;
  year: number | null;
  title: string | null;
  text: string | null;
  image: string | null;
  articleUrl: string | null;
  highlights: HighlightItem[];
  source: string;
  qualityScore: number;
  lastError?: string | null;
};

type ExistingHighlightCacheRow = {
  day: string;
  title: string | null;
  text: string;
  image: string | null;
  articleUrl: string | null;
  year: number | null;
  type: string;
  highlights?: unknown;
};

type PickDateCacheRow = {
  day: string;
  status: string;
  type: string;
  year: number | null;
  title: string | null;
  text: string | null;
  image: string | null;
  articleUrl: string | null;
  highlights?: unknown;
  source: string;
  qualityScore: number;
};

function getPickDateParts(day: string) {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const monthDay = day.slice(5, 10);
  const decade = Math.floor(year / 10) * 10;
  const century = Math.floor(year / 100) * 100;

  return {
    year,
    month,
    monthDay,
    decade,
    century,
  };
}

function mapTypeToLegacyType(rawType?: string | null): HighlightItem["type"] {
  switch (rawType) {
    case "selected":
      return "selected";
    case "event":
    case "events":
      return "events";
    case "birth":
    case "births":
      return "births";
    case "death":
    case "deaths":
      return "deaths";
    case "war":
      return "war";
    case "disaster":
      return "disaster";
    case "politics":
      return "politics";
    case "science":
      return "science";
    case "culture":
      return "culture";
    case "sports":
      return "sports";
    case "discovery":
      return "discovery";
    case "crime":
      return "crime";
    default:
      return "none";
  }
}

function inferKindFromType(rawType?: string | null): HighlightItem["kind"] {
  if (rawType === "birth" || rawType === "births") return "birth";
  if (rawType === "death" || rawType === "deaths") return "death";
  if (
    rawType === "event" ||
    rawType === "events" ||
    rawType === "selected"
  ) {
    return "event";
  }
  return "none";
}

function inferCategoryFromType(
  rawType?: string | null
): HighlightItem["category"] {
  switch (rawType) {
    case "war":
    case "disaster":
    case "politics":
    case "science":
    case "culture":
    case "sports":
    case "discovery":
    case "crime":
      return rawType;
    default:
      return "general";
  }
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWikiHighlightItem(item: unknown): HighlightItem | null {
  if (!item || typeof item !== "object") return null;

  const record = item as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim() : "";

  if (!text) return null;

  const rawType =
    typeof record.type === "string"
      ? record.type
      : typeof record.kind === "string"
        ? record.kind
        : null;

  const rawSecondaryType =
    typeof record.secondaryType === "string" ? record.secondaryType : null;

  const rawCategory =
    typeof record.category === "string" ? record.category : null;

  const kind = inferKindFromType(rawType);

  const category =
    rawCategory === "war" ||
    rawCategory === "disaster" ||
    rawCategory === "politics" ||
    rawCategory === "science" ||
    rawCategory === "culture" ||
    rawCategory === "sports" ||
    rawCategory === "discovery" ||
    rawCategory === "crime"
      ? rawCategory
      : inferCategoryFromType(rawType);

  const legacyType =
    rawType === "events" ||
    rawType === "births" ||
    rawType === "deaths" ||
    rawType === "war" ||
    rawType === "disaster" ||
    rawType === "politics" ||
    rawType === "science" ||
    rawType === "culture" ||
    rawType === "sports" ||
    rawType === "discovery" ||
    rawType === "crime" ||
    rawType === "selected" ||
    rawType === "none"
      ? (rawType as HighlightItem["type"])
      : mapTypeToLegacyType(rawType);

  return {
    title: typeof record.title === "string" ? record.title : null,
    text,
    image: typeof record.image === "string" ? record.image : null,
    articleUrl:
      typeof record.articleUrl === "string" ? record.articleUrl : null,
    year: typeof record.year === "number" ? record.year : null,
    type: legacyType,
    secondaryType: rawSecondaryType ? mapTypeToLegacyType(rawSecondaryType) : null,
    kind,
    category,
  };
}

function normalizeHighlights(raw: unknown): HighlightItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item: unknown) => normalizeWikiHighlightItem(item))
    .filter((item): item is HighlightItem => item !== null);
}

function normalizeExistingCacheRow(row: ExistingHighlightCacheRow): HighlightItem {
  return {
    title: row.title,
    text: row.text,
    image: row.image,
    articleUrl: row.articleUrl,
    year: row.year,
    type: mapTypeToLegacyType(row.type),
    kind: inferKindFromType(row.type),
    category: inferCategoryFromType(row.type),
    secondaryType: null,
  };
}

function scoreHighlight(item: HighlightItem) {
  let score = 0;

  if (item.type === "selected") score += 500;
  if (item.kind === "event") score += 420;
  if (item.kind === "birth") score += 320;
  if (item.kind === "death") score += 260;
  if (item.type && item.type !== "none") score += 120;
  if (item.title?.trim()) score += 70;
  if (item.image?.trim()) score += 70;
  if (item.articleUrl?.trim()) score += 40;
  if (item.text?.trim()) score += Math.min(item.text.trim().length, 280);

  return score;
}

function pickPrimaryHighlight(highlights: HighlightItem[]) {
  if (highlights.length === 0) return null;

  return [...highlights].sort((a, b) => scoreHighlight(b) - scoreHighlight(a))[0];
}

function getPrimaryType(primary: HighlightItem | null) {
  if (!primary) return "none";

  return (
    primary.type ??
    (primary.kind === "birth"
      ? "births"
      : primary.kind === "death"
        ? "deaths"
        : primary.kind === "event"
          ? "events"
          : "none")
  );
}

function getEmptyHighlight(): HighlightItem {
  return {
    title: null,
    text: PICK_DATE_EMPTY_TEXT,
    image: null,
    articleUrl: null,
    year: null,
    type: "none",
    kind: "none",
    category: "general",
    secondaryType: null,
  };
}

function buildNoMatchEntry(day: string, source: string): PickDateCacheEntry {
  const { year } = getPickDateParts(day);

  return {
    day,
    status: "no_match",
    type: "none",
    year,
    title: null,
    text: PICK_DATE_EMPTY_TEXT,
    image: null,
    articleUrl: null,
    highlights: [],
    source,
    qualityScore: 0,
    lastError: null,
  };
}

function buildReadyEntry(
  day: string,
  highlights: HighlightItem[],
  source: string
): PickDateCacheEntry {
  const primary = pickPrimaryHighlight(highlights);

  if (!primary) {
    return buildNoMatchEntry(day, source);
  }

  const { year } = getPickDateParts(day);

  return {
    day,
    status: "ready",
    type: getPrimaryType(primary),
    year,
    title: primary.title ?? null,
    text: primary.text,
    image: primary.image ?? null,
    articleUrl: primary.articleUrl ?? null,
    highlights,
    source,
    qualityScore: scoreHighlight(primary),
    lastError: null,
  };
}

function buildFeaturedEntry(day: string): PickDateCacheEntry | null {
  const item = getFeaturedMoment(day);

  if (!item) return null;

  const highlight: HighlightItem = {
    title: item.title,
    text: item.text,
    image: item.image,
    articleUrl: item.articleUrl,
    year: Number(item.day.slice(0, 4)) || null,
    type: item.type,
    secondaryType: item.secondaryType
      ? mapTypeToLegacyType(item.secondaryType)
      : null,
    kind: "event",
    category: inferCategoryFromType(item.type),
  };

  return buildReadyEntry(day, [highlight], "featured_moment");
}

async function buildEntryFromExistingDayHighlightCache(day: string) {
  const row = await prisma.dayHighlightCache.findUnique({
    where: { day },
    select: {
      day: true,
      title: true,
      text: true,
      image: true,
      articleUrl: true,
      year: true,
      type: true,
      highlights: true,
    },
  });

  if (!row) return null;

  if (row.type === "none" || row.text.trim() === PICK_DATE_EMPTY_TEXT) {
    return buildNoMatchEntry(day, "day_highlight_cache");
  }

  const cachedHighlights = normalizeHighlights(row.highlights);

  if (cachedHighlights.length > 0) {
    return buildReadyEntry(day, cachedHighlights, "day_highlight_cache");
  }

  const fallback = normalizeExistingCacheRow(row);

  if (!isNonEmptyText(fallback.text) || fallback.type === "none") {
    return buildNoMatchEntry(day, "day_highlight_cache");
  }

  return buildReadyEntry(day, [fallback], "day_highlight_cache");
}

function mapPickCacheRow(row: PickDateCacheRow): HighlightResponse {
  const highlights = normalizeHighlights(row.highlights);

  if (row.status === "ready") {
    if (highlights.length > 0) {
      return {
        highlight: pickPrimaryHighlight(highlights) ?? undefined,
        highlights,
      };
    }

    if (isNonEmptyText(row.text)) {
      const fallback: HighlightItem = {
        title: row.title,
        text: row.text,
        image: row.image,
        articleUrl: row.articleUrl,
        year: row.year,
        type: mapTypeToLegacyType(row.type),
        kind: inferKindFromType(row.type),
        category: inferCategoryFromType(row.type),
        secondaryType: null,
      };

      return {
        highlight: fallback,
        highlights: [fallback],
      };
    }
  }

  return {
    highlight: getEmptyHighlight(),
    highlights: [],
  };
}

export async function readPickDateHighlight(day: string): Promise<HighlightResponse> {
  const row = await prisma.pickDateCache.findUnique({
    where: { day },
    select: {
      day: true,
      status: true,
      type: true,
      year: true,
      title: true,
      text: true,
      image: true,
      articleUrl: true,
      highlights: true,
      source: true,
      qualityScore: true,
    },
  });

  if (row) {
    return mapPickCacheRow(row);
  }

  const existing = await buildEntryFromExistingDayHighlightCache(day);

  if (existing) {
    return entryToHighlightResponse(existing);
  }

  return {
    highlight: getEmptyHighlight(),
    highlights: [],
  };
}

export function entryToHighlightResponse(entry: PickDateCacheEntry): HighlightResponse {
  if (entry.status === "ready") {
    const primary = pickPrimaryHighlight(entry.highlights);

    return {
      highlight: primary ?? undefined,
      highlights: entry.highlights,
    };
  }

  return {
    highlight: getEmptyHighlight(),
    highlights: [],
  };
}

export async function upsertPickDateCacheEntry(entry: PickDateCacheEntry) {
  const now = new Date();
  const { year, month, monthDay, decade, century } = getPickDateParts(entry.day);

  return prisma.pickDateCache.upsert({
    where: { day: entry.day },
    update: {
      status: entry.status,
      type: entry.type,
      year,
      month,
      monthDay,
      decade,
      century,
      title: entry.title,
      text: entry.text,
      image: entry.image,
      articleUrl: entry.articleUrl,
      highlights: entry.highlights,
      source: entry.source,
      qualityScore: entry.qualityScore,
      attempts: { increment: 1 },
      lastError: entry.lastError ?? null,
      generatedAt: now,
    },
    create: {
      day: entry.day,
      status: entry.status,
      type: entry.type,
      year,
      month,
      monthDay,
      decade,
      century,
      title: entry.title,
      text: entry.text,
      image: entry.image,
      articleUrl: entry.articleUrl,
      highlights: entry.highlights,
      source: entry.source,
      qualityScore: entry.qualityScore,
      attempts: 1,
      lastError: entry.lastError ?? null,
      generatedAt: now,
    },
  });
}

export async function buildPickDateCacheEntry(
  day: string,
  options?: {
    ignoreExistingDayHighlightCache?: boolean;
  }
): Promise<PickDateCacheEntry> {
  const featured = buildFeaturedEntry(day);

  if (featured) {
    return featured;
  }

  const existing = options?.ignoreExistingDayHighlightCache
    ? null
    : await buildEntryFromExistingDayHighlightCache(day);

  if (existing) {
    return existing;
  }

  try {
    const lookup = await getDayHighlightsLookup(day);
    const highlights = normalizeHighlights(lookup.highlights).filter(
      (item) => isNonEmptyText(item.text) && item.type !== "none"
    );

    if (highlights.length > 0) {
      return buildReadyEntry(day, highlights, "wiki_on_this_day");
    }

    if (lookup.hadSuccessfulFetch) {
      return buildNoMatchEntry(day, "wiki_on_this_day");
    }

    return {
      ...buildNoMatchEntry(day, "wiki_on_this_day"),
      status: "failed",
      lastError: "Wikipedia lookup did not complete successfully.",
    };
  } catch (error) {
    return {
      ...buildNoMatchEntry(day, "wiki_on_this_day"),
      status: "failed",
      lastError:
        error instanceof Error ? error.message : "Unknown pick date cache error",
    };
  }
}

export async function generatePickDateCacheForDay(
  day: string,
  options?: {
    dryRun?: boolean;
    refresh?: boolean;
  }
) {
  if (!options?.refresh) {
    const existing = await prisma.pickDateCache.findUnique({
      where: { day },
      select: {
        day: true,
        status: true,
        type: true,
        year: true,
        title: true,
        text: true,
        image: true,
        articleUrl: true,
        highlights: true,
        source: true,
        qualityScore: true,
      },
    });

    if (existing) {
      return {
        entry: {
          day: existing.day,
          status: existing.status as PickDateCacheStatus,
          type: existing.type,
          year: existing.year,
          title: existing.title,
          text: existing.text,
          image: existing.image,
          articleUrl: existing.articleUrl,
          highlights: normalizeHighlights(existing.highlights),
          source: existing.source,
          qualityScore: existing.qualityScore,
          lastError: null,
        },
        skippedExisting: true,
      };
    }
  }

  const entry = await buildPickDateCacheEntry(day, {
    ignoreExistingDayHighlightCache: options?.refresh,
  });

  if (!options?.dryRun) {
    await upsertPickDateCacheEntry(entry);
  }

  return {
    entry,
    skippedExisting: false,
  };
}