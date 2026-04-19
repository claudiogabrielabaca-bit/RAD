import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_MATCH_LABEL = "No exact historical match";

type RankedDay = {
  day: string;
  avg: number;
  count: number;
  title: string | null;
};

type CacheTitleRow = {
  day: string;
  title: string | null;
  type: string;
};

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

async function buildTitleMap(days: string[]): Promise<Map<string, string>> {
  const uniqueDays = [...new Set(days)];

  const cached: CacheTitleRow[] = await prisma.dayHighlightCache.findMany({
    where: {
      day: { in: uniqueDays },
    },
    select: {
      day: true,
      title: true,
      type: true,
    },
  });

  const cachedByDay = new Map<string, CacheTitleRow>(
    cached.map((row: CacheTitleRow) => [row.day, row])
  );

  const daysNeedingResolution = uniqueDays.filter((day) => {
    const row = cachedByDay.get(day);

    if (!row) return true;
    if (row.title?.trim()) return false;
    if (row.type === "none") return false;

    return true;
  });

  const resolvedEntries = await Promise.all(
    daysNeedingResolution.map(async (day) => {
      try {
        const result = await ensureHighlightsForDay(day);
        const primary = result.highlight ?? result.highlights?.[0] ?? null;

        const label =
          primary?.title?.trim() ||
          (primary?.type === "none" ? NO_MATCH_LABEL : NO_MATCH_LABEL);

        return [day, label] as const;
      } catch {
        return [day, NO_MATCH_LABEL] as const;
      }
    })
  );

  const resolvedByDay = new Map<string, string>(resolvedEntries);
  const finalMap = new Map<string, string>();

  for (const day of uniqueDays) {
    const cachedRow = cachedByDay.get(day);

    if (cachedRow?.title?.trim()) {
      finalMap.set(day, cachedRow.title.trim());
      continue;
    }

    if (cachedRow?.type === "none") {
      finalMap.set(day, NO_MATCH_LABEL);
      continue;
    }

    finalMap.set(day, resolvedByDay.get(day) ?? NO_MATCH_LABEL);
  }

  return finalMap;
}

function attachTitles(
  items: Array<{ day: string; avg: number; count: number }>,
  titleMap: Map<string, string>
): RankedDay[] {
  return items.map((item) => ({
    ...item,
    title: titleMap.get(item.day) ?? NO_MATCH_LABEL,
  }));
}

export async function GET() {
  try {
    const ratings: { day: string; stars: number }[] = await prisma.rating.findMany({
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

    const titleMap = await buildTitleMap([
      ...sortedTop.map((item) => item.day),
      ...sortedLow.map((item) => item.day),
    ]);

    const top = attachTitles(sortedTop, titleMap);
    const low = attachTitles(sortedLow, titleMap);

    return NextResponse.json(
      { top, low },
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