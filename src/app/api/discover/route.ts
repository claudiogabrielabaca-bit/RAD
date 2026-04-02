import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import type { DiscoverCard } from "@/app/lib/rad-types";

export const dynamic = "force-dynamic";

const FEATURED_MODERN_MOMENTS: Array<{
  day: string;
  title: string;
  text: string;
  type: DiscoverCard["type"];
  image: string | null;
}> = [
  {
    day: "1815-06-18",
    title: "Battle of Waterloo",
    text: "Napoleon was defeated at Waterloo, ending his rule and reshaping the political order of Europe.",
    type: "war",
    image: "/featured/waterloo.jpg",
  },
  {
    day: "1914-07-28",
    title: "World War I begins",
    text: "Austria-Hungary declared war on Serbia, triggering the global conflict that shattered the old world order.",
    type: "war",
    image: "/featured/ww1.jpg",
  },
  {
    day: "1939-09-01",
    title: "World War II begins",
    text: "Germany invaded Poland, beginning the deadliest war in human history and redrawing the balance of power.",
    type: "war",
    image: "/featured/ww2.jpg",
  },
  {
    day: "1969-07-20",
    title: "Moon landing",
    text: "Apollo 11 put humans on the Moon, becoming one of the defining scientific achievements of modern history.",
    type: "science",
    image: "/featured/moon-landing.jpg",
  },
  {
    day: "1989-11-09",
    title: "Fall of the Berlin Wall",
    text: "The Berlin Wall opened, becoming the clearest symbol of the collapse of the Cold War order in Europe.",
    type: "politics",
    image: "/featured/berlin-wall.jpg",
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseCardType(value: unknown): DiscoverCard["type"] | null {
  switch (value) {
    case "selected":
    case "events":
    case "births":
    case "deaths":
    case "war":
    case "disaster":
    case "politics":
    case "science":
    case "culture":
    case "sports":
    case "discovery":
    case "crime":
    case "none":
      return value;
    default:
      return null;
  }
}

function isSpecificCardType(
  value: DiscoverCard["type"] | null | undefined
): value is DiscoverCard["type"] {
  return !!value && !["selected", "events", "births", "deaths", "none"].includes(value);
}

function getSpecificTypeFromHighlightRecord(
  item: unknown
): DiscoverCard["type"] | null {
  if (!item || typeof item !== "object") return null;

  const record = item as Record<string, unknown>;

  const category = parseCardType(record.category);
  if (isSpecificCardType(category)) {
    return category;
  }

  const type = parseCardType(record.type);
  if (isSpecificCardType(type)) {
    return type;
  }

  const secondaryType = parseCardType(record.secondaryType);
  if (isSpecificCardType(secondaryType)) {
    return secondaryType;
  }

  return null;
}

function extractSpecificTypeFromHighlights(
  raw: unknown
): DiscoverCard["type"] | null {
  if (!Array.isArray(raw)) return null;

  for (const item of raw) {
    const specific = getSpecificTypeFromHighlightRecord(item);
    if (specific) {
      return specific;
    }
  }

  return null;
}

function resolveCardType(
  cached: {
    type?: string | null;
    highlights?: unknown;
  } | null | undefined,
  fallback: DiscoverCard["type"]
): DiscoverCard["type"] {
  const specificFromHighlights = extractSpecificTypeFromHighlights(
    cached?.highlights
  );

  if (specificFromHighlights) {
    return specificFromHighlights;
  }

  const cachedType = parseCardType(cached?.type);

  if (isSpecificCardType(cachedType)) {
    return cachedType;
  }

  return fallback;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCount = Number(searchParams.get("count") ?? "5");
    const count = clamp(
      Number.isFinite(rawCount) ? rawCount : 5,
      1,
      FEATURED_MODERN_MOMENTS.length
    );

    const featured = FEATURED_MODERN_MOMENTS.slice(0, count);
    const featuredDays = featured.map((item) => item.day);

    const [cachedRows, stats, dayStats] = await Promise.all([
      prisma.dayHighlightCache.findMany({
        where: {
          day: {
            in: featuredDays,
          },
        },
        select: {
          day: true,
          title: true,
          text: true,
          image: true,
          type: true,
          highlights: true,
        },
      }),
      prisma.rating.groupBy({
        by: ["day"],
        where: {
          day: {
            in: featuredDays,
          },
        },
        _count: {
          day: true,
        },
        _avg: {
          stars: true,
        },
      }),
      prisma.dayStats.findMany({
        where: {
          day: {
            in: featuredDays,
          },
        },
        select: {
          day: true,
          views: true,
        },
      }),
    ]);

    const cacheMap = new Map(cachedRows.map((item) => [item.day, item]));
    const statsMap = new Map(
      stats.map((item) => [
        item.day,
        {
          avg: item._avg.stars ?? 0,
          count: item._count.day ?? 0,
        },
      ])
    );
    const viewsMap = new Map(dayStats.map((item) => [item.day, item.views]));

    const cards: DiscoverCard[] = featured.map((item) => {
      const cached = cacheMap.get(item.day);
      const cachedImage = cached?.image?.trim();

      return {
        day: item.day,
        title: cached?.title?.trim() || item.title,
        text: cached?.text?.trim() || item.text,
        image: cachedImage || item.image,
        avg: statsMap.get(item.day)?.avg ?? 0,
        count: statsMap.get(item.day)?.count ?? 0,
        views: viewsMap.get(item.day) ?? 0,
        type: resolveCardType(cached, item.type),
      };
    });

    return NextResponse.json(
      { cards },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("discover GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}