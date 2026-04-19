import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { FEATURED_MOMENTS } from "@/app/lib/featured-moments";
import type { DiscoverCard } from "@/app/lib/rad-types";

export const dynamic = "force-dynamic";

type RatingStatsRow = {
  day: string;
  _avg: {
    stars: number | null;
  };
  _count: {
    day: number;
  };
};

type DayStatsRow = {
  day: string;
  views: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCount = Number(searchParams.get("count") ?? "5");
    const count = clamp(
      Number.isFinite(rawCount) ? rawCount : 5,
      1,
      FEATURED_MOMENTS.length
    );

    const featured = FEATURED_MOMENTS.slice(0, count);
    const featuredDays = featured.map((item) => item.day);

    const [stats, dayStats]: [RatingStatsRow[], DayStatsRow[]] =
      await Promise.all([
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

    const statsMap = new Map<string, { avg: number; count: number }>(
      stats.map((item: RatingStatsRow) => [
        item.day,
        {
          avg: item._avg.stars ?? 0,
          count: item._count.day ?? 0,
        },
      ])
    );

    const viewsMap = new Map<string, number>(
      dayStats.map((item: DayStatsRow) => [item.day, item.views])
    );

    const cards: DiscoverCard[] = featured.map((item) => ({
      day: item.day,
      title: item.title,
      text: item.text,
      image: item.image,
      avg: statsMap.get(item.day)?.avg ?? 0,
      count: statsMap.get(item.day)?.count ?? 0,
      views: viewsMap.get(item.day) ?? 0,
      type: item.type,
    }));

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