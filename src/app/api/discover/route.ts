import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import type { DiscoverCard } from "@/app/lib/rad-types";

export const dynamic = "force-dynamic";

const FEATURED_CENTURY_MOMENTS: Array<{
  day: string;
  title: string;
  text: string;
  type: DiscoverCard["type"];
}> = [
  {
    day: "1914-07-28",
    title: "World War I begins",
    text: "Austria-Hungary declared war on Serbia, triggering a global conflict that reshaped the 20th century.",
    type: "war",
  },
  {
    day: "1929-10-24",
    title: "Wall Street Crash",
    text: "The collapse of the stock market accelerated the Great Depression and transformed the modern global economy.",
    type: "disaster",
  },
  {
    day: "1939-09-01",
    title: "World War II begins",
    text: "Germany invaded Poland, starting the deadliest war in human history and redrawing the world's balance of power.",
    type: "war",
  },
  {
    day: "1969-07-20",
    title: "Moon landing",
    text: "Apollo 11 put humans on the Moon, becoming one of the greatest scientific and symbolic achievements of the century.",
    type: "science",
  },
  {
    day: "1989-11-09",
    title: "Fall of the Berlin Wall",
    text: "The collapse of the Berlin Wall became the defining symbol of the end of the Cold War era.",
    type: "politics",
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeCardType(
  value: string | null | undefined,
  fallback: DiscoverCard["type"]
): DiscoverCard["type"] {
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
      return fallback;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCount = Number(searchParams.get("count") ?? "5");
    const count = clamp(
      Number.isFinite(rawCount) ? rawCount : 5,
      1,
      FEATURED_CENTURY_MOMENTS.length
    );

    const featured = FEATURED_CENTURY_MOMENTS.slice(0, count);
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

      return {
        day: item.day,
        title: cached?.title?.trim() || item.title,
        text: cached?.text?.trim() || item.text,
        image: cached?.image?.trim() || null,
        avg: statsMap.get(item.day)?.avg ?? 0,
        count: statsMap.get(item.day)?.count ?? 0,
        views: viewsMap.get(item.day) ?? 0,
        type: normalizeCardType(cached?.type, item.type),
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