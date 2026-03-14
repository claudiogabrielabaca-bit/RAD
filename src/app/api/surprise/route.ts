import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/current-user";
import { getAnonLabel } from "@/app/lib/anon-label";
import { getRandomValidDay } from "@/app/lib/random-valid-day";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get("fresh") === "1";

    const result = await getRandomValidDay({
      fresh,
      maxCacheTake: 500,
      maxAttempts: 12,
    });

    if (!result) {
      return NextResponse.json(
        { error: "No valid random day found." },
        { status: 404 }
      );
    }

    const day = result.day;

    const [user, highlightResult, ratings, stats] = await Promise.all([
      getCurrentUser(),
      ensureHighlightsForDay(day),
      prisma.rating.findMany({
        where: { day },
        orderBy: { createdAt: "desc" },
        include: {
          likes: true,
          replies: {
            orderBy: {
              createdAt: "asc",
            },
            include: {
              user: {
                select: {
                  username: true,
                },
              },
            },
          },
          user: {
            select: {
              username: true,
            },
          },
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
        likedByMe: user ? r.likes.some((like) => like.userId === user.id) : false,
        isMine: user ? r.userId === user.id : false,
        authorLabel: r.user?.username
          ? `@${r.user.username}`
          : r.anonId
            ? getAnonLabel(r.anonId)
            : "User",
        replies: r.replies.map((reply) => ({
          id: reply.id,
          text: reply.text,
          createdAt: reply.createdAt.toISOString(),
          isMine: user ? reply.userId === user.id : false,
          authorLabel: reply.user?.username
            ? `@${reply.user.username}`
            : reply.anonId
              ? getAnonLabel(reply.anonId)
              : "User",
        })),
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
        source: result.source,
        dayData: {
          day,
          avg,
          count,
          views: stats?.views ?? 0,
          reviews,
        },
        highlightData: {
          highlight: highlightResult.highlight,
          highlights: highlightResult.highlights,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("surprise GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}