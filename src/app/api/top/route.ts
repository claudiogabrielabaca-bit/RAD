import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const ratings = await prisma.rating.findMany({
      select: {
        day: true,
        stars: true,
      },
    });

    const grouped: Record<string, { total: number; count: number }> = {};

    for (const rating of ratings) {
      if (!grouped[rating.day]) {
        grouped[rating.day] = { total: 0, count: 0 };
      }

      grouped[rating.day].total += rating.stars;
      grouped[rating.day].count += 1;
    }

    const result = Object.entries(grouped).map(([day, data]) => ({
      day,
      avg: data.total / data.count,
      count: data.count,
    }));

    // filtro opcional para que no entre cualquier día con 1 solo voto
    const minVotes = 1;

    const filtered = result.filter((item) => item.count >= minVotes);

    const top = [...filtered]
      .sort((a, b) => {
        if (b.avg !== a.avg) return b.avg - a.avg;
        return b.count - a.count;
      })
      .slice(0, 6);

    const low = [...filtered]
      .sort((a, b) => {
        if (a.avg !== b.avg) return a.avg - b.avg;
        return b.count - a.count;
      })
      .slice(0, 6);

    return NextResponse.json(
      { top, low },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}