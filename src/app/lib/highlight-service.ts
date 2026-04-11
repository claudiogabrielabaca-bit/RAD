import { prisma } from "@/app/lib/prisma";
import { getFeaturedMoment } from "@/app/lib/featured-moments";
import { getDayHighlights } from "@/app/lib/wiki";
import type { HighlightItem, HighlightResponse } from "@/app/lib/rad-types";

const EMPTY_FALLBACK_TEXT = "No exact historical match was found for this date.";

type CachedRow = {
  day: string;
  title: string | null;
  text: string;
  image: string | null;
  articleUrl: string | null;
  year: number | null;
  type: string;
  highlights?: unknown;
};

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

function normalizeCachedHighlight(row: CachedRow): HighlightItem {
  return {
    title: row.title,
    text: row.text,
    image: row.image,
    articleUrl: row.articleUrl,
    year: row.year,
    type: mapTypeToLegacyType(row.type),
    kind: inferKindFromType(row.type),
    category: inferCategoryFromType(row.type),
  };
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWikiHighlightItem(item: unknown): HighlightItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;

  const text = typeof record.text === "string" ? record.text.trim() : "";
  if (!text) {
    return null;
  }

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

  const kind =
    rawType === "birth" || rawType === "births"
      ? "birth"
      : rawType === "death" || rawType === "deaths"
        ? "death"
        : rawType === "event" ||
            rawType === "events" ||
            rawType === "selected"
          ? "event"
          : "none";

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

  const secondaryType = rawSecondaryType
    ? mapTypeToLegacyType(rawSecondaryType)
    : null;

  return {
    title: typeof record.title === "string" ? record.title : null,
    text,
    image: typeof record.image === "string" ? record.image : null,
    articleUrl:
      typeof record.articleUrl === "string" ? record.articleUrl : null,
    year: typeof record.year === "number" ? record.year : null,
    type: legacyType,
    secondaryType,
    kind,
    category,
  };
}

function normalizeWikiHighlights(raw: unknown): HighlightItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item: unknown) => normalizeWikiHighlightItem(item))
    .filter((item): item is HighlightItem => item !== null);
}

function pickPrimaryHighlight(
  highlights: HighlightItem[]
): HighlightItem | undefined {
  if (highlights.length === 0) {
    return undefined;
  }

  const score = (item: HighlightItem) => {
    if (item.type === "selected") return 100;
    if (item.kind === "event") return 80;
    if (item.kind === "birth") return 60;
    if (item.kind === "death") return 50;
    if (item.type && item.type !== "none") return 40;
    return 0;
  };

  return [...highlights].sort((a, b) => score(b) - score(a))[0];
}

function getEmptyResponse(): HighlightResponse {
  return {
    highlight: {
      title: null,
      text: EMPTY_FALLBACK_TEXT,
      image: null,
      articleUrl: null,
      year: null,
      type: "none",
      kind: "none",
      category: "general",
      secondaryType: null,
    },
    highlights: [],
  };
}

function buildFeaturedHighlightResponse(day: string): HighlightResponse | null {
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

  return {
    highlight,
    highlights: [highlight],
  };
}

function shouldUseFeaturedOverride(row: CachedRow | null | undefined) {
  if (!row) return true;
  if (row.type === "none") return true;
  if (!isNonEmptyText(row.text)) return true;
  if (row.text.trim() === EMPTY_FALLBACK_TEXT) return true;
  if (!row.title?.trim()) return true;
  if (!row.image?.trim()) return true;
  return false;
}

async function readCachedHighlights(
  day: string
): Promise<HighlightResponse | null> {
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

  const featured = buildFeaturedHighlightResponse(day);

  if (featured && shouldUseFeaturedOverride(row as CachedRow | null)) {
    await writeHighlightsToCache(day, featured.highlights ?? []);
    return featured;
  }

  if (!row) {
    return null;
  }

  if (
    row.type === "none" ||
    row.text?.trim() === EMPTY_FALLBACK_TEXT
  ) {
    return null;
  }

  const cachedHighlights = normalizeWikiHighlights(row.highlights);

  if (cachedHighlights.length > 0) {
    return {
      highlight: pickPrimaryHighlight(cachedHighlights),
      highlights: cachedHighlights,
    };
  }

  const fallback = normalizeCachedHighlight(row as CachedRow);

  if (!isNonEmptyText(fallback.text)) {
    return getEmptyResponse();
  }

  return {
    highlight: fallback,
    highlights: [fallback],
  };
}

async function writeHighlightsToCache(day: string, highlights: HighlightItem[]) {
  const primary = pickPrimaryHighlight(highlights);

  if (!primary) {
    const featured = buildFeaturedHighlightResponse(day);

    if (featured?.highlight) {
      const featuredPrimary = featured.highlight;

      await prisma.dayHighlightCache.upsert({
        where: { day },
        update: {
          title: featuredPrimary.title ?? null,
          text: featuredPrimary.text,
          image: featuredPrimary.image ?? null,
          articleUrl: featuredPrimary.articleUrl ?? null,
          year: featuredPrimary.year ?? null,
          type: featuredPrimary.type ?? "selected",
          highlights: featured.highlights ?? [],
        },
        create: {
          day,
          title: featuredPrimary.title ?? null,
          text: featuredPrimary.text,
          image: featuredPrimary.image ?? null,
          articleUrl: featuredPrimary.articleUrl ?? null,
          year: featuredPrimary.year ?? null,
          type: featuredPrimary.type ?? "selected",
          highlights: featured.highlights ?? [],
        },
      });

      return;
    }

    await prisma.dayHighlightCache.deleteMany({
      where: {
        day,
        type: "none",
      },
    });

    return;
  }

  await prisma.dayHighlightCache.upsert({
    where: { day },
    update: {
      title: primary.title ?? null,
      text: primary.text,
      image: primary.image ?? null,
      articleUrl: primary.articleUrl ?? null,
      year: primary.year ?? null,
      type:
        primary.type ??
        (primary.kind === "birth"
          ? "births"
          : primary.kind === "death"
            ? "deaths"
            : primary.kind === "event"
              ? "events"
              : "none"),
      highlights: highlights,
    },
    create: {
      day,
      title: primary.title ?? null,
      text: primary.text,
      image: primary.image ?? null,
      articleUrl: primary.articleUrl ?? null,
      year: primary.year ?? null,
      type:
        primary.type ??
        (primary.kind === "birth"
          ? "births"
          : primary.kind === "death"
            ? "deaths"
            : primary.kind === "event"
              ? "events"
              : "none"),
      highlights: highlights,
    },
  });
}

export async function ensureHighlightsForDay(
  day: string
): Promise<HighlightResponse> {
  const cached = await readCachedHighlights(day);

  if (cached) {
    return cached;
  }

  const featured = buildFeaturedHighlightResponse(day);
  if (featured) {
    await writeHighlightsToCache(day, featured.highlights ?? []);
    return featured;
  }

  const rawHighlights = await getDayHighlights(day);
  const highlights = normalizeWikiHighlights(rawHighlights).filter((item) =>
    isNonEmptyText(item.text)
  );

  await writeHighlightsToCache(day, highlights);

  if (highlights.length === 0) {
    return getEmptyResponse();
  }

  return {
    highlight: pickPrimaryHighlight(highlights),
    highlights,
  };
}