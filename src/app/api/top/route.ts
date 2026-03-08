import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RankedDay = {
  day: string;
  avg: number;
  count: number;
  title: string | null;
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

async function attachTitles(
  items: Array<{ day: string; avg: number; count: number }>
): Promise<RankedDay[]> {
  const days = items.map((item) => item.day);

  const highlights = await prisma.dayHighlightCache.findMany({
    where: {
      day: { in: days },
    },
    select: {
      day: true,
      title: true,
    },
  });

  const titleByDay = new Map(highlights.map((h) => [h.day, h.title]));

  return items.map((item) => ({
    ...item,
    title: titleByDay.get(item.day) ?? null,
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

    const top = await attachTitles(sortedTop);
    const low = await attachTitles(sortedLow);

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