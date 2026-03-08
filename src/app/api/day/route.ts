import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getOrCreateAnonId } from "@/app/lib/anon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const anonId = await getOrCreateAnonId();
    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day");

    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }

    const [ratings, stats] = await Promise.all([
      prisma.rating.findMany({
        where: { day },
        orderBy: { createdAt: "desc" },
        include: {
          likes: true,
        },
      }),
      prisma.dayStats.findUnique({
        where: { day },
        select: { views: true },
      }),
    ]);

    const count = ratings.length;
    const avg =
      count === 0
        ? 0
        : ratings.reduce((acc, r) => acc + r.stars, 0) / count;

    const reviews = ratings
      .map((r) => ({
        id: r.id,
        stars: r.stars,
        review: r.review,
        createdAt: r.createdAt.toISOString(),
        likesCount: r.likes.length,
        likedByMe: r.likes.some((like) => like.anonId === anonId),
        isMine: r.anonId === anonId,
      }))
      .sort((a, b) => {
        if (a.isMine && !b.isMine) return -1;
        if (!a.isMine && b.isMine) return 1;

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    return NextResponse.json(
      {
        day,
        avg,
        count,
        views: stats?.views ?? 0,
        reviews,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("day GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}