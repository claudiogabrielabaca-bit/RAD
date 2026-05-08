import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_MATCH_LABEL = "No exact historical match";
const EMPTY_HIGHLIGHT_TEXT = "No exact historical match was found for this date.";

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

function groupRatings(
  ratings: { day: string; stars: number }[]
): Array<{ day: string; avg: number; count: number }> {
  const byDay = new Map<string, { total: number; count: number }>();

  for (const rating of ratings) {
    const current = byDay.get(rating.day) ?? { total: 0, count: 0 };

    current.total += rating.stars;
    current.count += 1;

    byDay.set(rating.day, current);
  }

  return Array.from(byDay.entries()).map(([day, value]) => ({
    day,
    avg: value.total / value.count,
    count: value.count,
  }));
}

async function buildContextMap(days: string[]) {
  const uniqueDays = Array.from(new Set(days));

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

export async function GET() {
  try {
    const ratings = await prisma.rating.findMany({
      select: {
        day: true,
        stars: true,
      },
    });

    const grouped = groupRatings(ratings).filter((item) => item.count > 0);

    const sortedTop = [...grouped]
      .sort((a, b) => {
        if (b.avg !== a.avg) return b.avg - a.avg;
        return b.count - a.count;
      })
      .slice(0, 10);

    const sortedLow = [...grouped]
      .sort((a, b) => {
        if (a.avg !== b.avg) return a.avg - b.avg;
        return b.count - a.count;
      })
      .slice(0, 10);

    const cacheByDay = await buildContextMap([
      ...sortedTop.map((item) => item.day),
      ...sortedLow.map((item) => item.day),
    ]);

    return NextResponse.json(
      {
        top: attachContext(sortedTop, cacheByDay),
        low: attachContext(sortedLow, cacheByDay),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("top GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}