import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sampleRandomCachedHighlights } from "@/app/lib/random-valid-day";

export const dynamic = "force-dynamic";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function getDayYear(day: string) {
  return Number(day.slice(0, 4)) || 0;
}

function getDayMonth(day: string) {
  return day.slice(5, 7);
}

function getDayDecade(day: string) {
  const year = getDayYear(day);
  return year ? Math.floor(year / 10) * 10 : 0;
}

function pickDiscoverItems<
  T extends {
    day: string;
    title: string | null;
    text: string;
    image: string | null;
    type: string;
  },
>(pool: T[], count: number) {
  const remaining = shuffleArray(
    pool.filter(
      (item) =>
        !!item.day &&
        !!item.title?.trim() &&
        !!item.text?.trim() &&
        !!item.image?.trim()
    )
  );

  const selected: T[] = [];
  const usedDecades = new Set<number>();
  const usedYears = new Set<number>();
  const usedMonths = new Set<string>();

  while (remaining.length > 0 && selected.length < count) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const decade = getDayDecade(item.day);
      const year = getDayYear(item.day);
      const month = getDayMonth(item.day);

      let score = Math.random() * 10;

      if (!usedDecades.has(decade)) score += 30;
      if (!usedYears.has(year)) score += 8;
      if (!usedMonths.has(month)) score += 5;
      if (item.image) score += 2;
      if ((item.title?.length ?? 0) > 24) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const [picked] = remaining.splice(bestIndex, 1);

    if (!picked) break;

    selected.push(picked);
    usedDecades.add(getDayDecade(picked.day));
    usedYears.add(getDayYear(picked.day));
    usedMonths.add(getDayMonth(picked.day));
  }

  return selected;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawCount = Number(searchParams.get("count") ?? "5");
    const fresh = searchParams.get("fresh") === "1";

    const count = clamp(Number.isFinite(rawCount) ? rawCount : 5, 1, 12);

    const sampleSize = fresh
      ? Math.max(count * 10, 36)
      : Math.max(count * 8, 24);

    const pool = await sampleRandomCachedHighlights({
      sampleSize,
      requireImage: true,
    });

    const selected = pickDiscoverItems(pool, count);
    const selectedDays = selected.map((item) => item.day);

    if (selectedDays.length === 0) {
      return NextResponse.json(
        { cards: [] },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const [stats, dayStats] = await Promise.all([
      prisma.rating.groupBy({
        by: ["day"],
        where: {
          day: {
            in: selectedDays,
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
            in: selectedDays,
          },
        },
        select: {
          day: true,
          views: true,
        },
      }),
    ]);

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

    const cards = selected.map((item) => ({
      day: item.day,
      title: item.title?.trim() || "Historical day",
      text: item.text?.trim() || "Discover this day in history.",
      image: item.image ?? null,
      avg: statsMap.get(item.day)?.avg ?? 0,
      count: statsMap.get(item.day)?.count ?? 0,
      views: viewsMap.get(item.day) ?? 0,
      type: item.type as
        | "selected"
        | "events"
        | "births"
        | "deaths"
        | "war"
        | "disaster"
        | "politics"
        | "science"
        | "culture"
        | "sports"
        | "discovery"
        | "crime"
        | "none",
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