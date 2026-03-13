import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function shuffleArray<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const countParam = Number(searchParams.get("count") ?? "5");
    const count = Math.max(1, Math.min(12, countParam));

    const validHighlights = await prisma.dayHighlightCache.findMany({
      where: {
        type: {
          not: "none",
        },
        title: {
          not: null,
        },
        image: {
          not: null,
        },
        text: {
          not: "",
        },
      },
      select: {
        day: true,
        title: true,
        text: true,
        image: true,
        type: true,
      },
      take: 400,
      orderBy: {
        updatedAt: "desc",
      },
    });

    const filtered = validHighlights.filter(
      (item) =>
        !!item.day &&
        !!item.title?.trim() &&
        !!item.text?.trim() &&
        !!item.image?.trim()
    );

    const shuffled = shuffleArray(filtered).slice(0, count);
    const selectedDays = shuffled.map((item) => item.day);

    const stats = selectedDays.length
      ? await prisma.rating.groupBy({
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
        })
      : [];

    const dayStats = selectedDays.length
      ? await prisma.dayStats.findMany({
          where: {
            day: {
              in: selectedDays,
            },
          },
          select: {
            day: true,
            views: true,
          },
        })
      : [];

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

    const cards = shuffled.map((item) => ({
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