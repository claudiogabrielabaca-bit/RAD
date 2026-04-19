import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/current-user";
import { getAnonLabel } from "@/app/lib/anon-label";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";
import { getNextSurpriseDay } from "@/app/lib/surprise-deck";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

type SurpriseReplyRow = {
  id: string;
  text: string;
  createdAt: Date;
  anonId: string | null;
  userId: string | null;
  user: {
    username: string;
  } | null;
};

type SurpriseRatingRow = {
  id: string;
  stars: number;
  review: string;
  createdAt: Date;
  anonId: string | null;
  userId: string | null;
  likes: { id: string; userId: string | null }[];
  replies: SurpriseReplyRow[];
  user: {
    username: string;
  } | null;
};

function buildReplySummaries(
  replies: SurpriseReplyRow[],
  user: CurrentUser
) {
  return replies.map((reply: SurpriseReplyRow) => ({
    id: reply.id,
    text: reply.text,
    createdAt: reply.createdAt.toISOString(),
    isMine: user ? reply.userId === user.id : false,
    authorLabel: reply.user?.username
      ? `@${reply.user.username}`
      : reply.anonId
        ? getAnonLabel(reply.anonId)
        : "User",
  }));
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    const result = await getNextSurpriseDay({
      userId: user?.id ?? null,
    });

    if (!result) {
      return NextResponse.json(
        { error: "No valid surprise day found." },
        { status: 404 }
      );
    }

    const day = result.day;

    const [highlightResult, ratings, stats]: [
      Awaited<ReturnType<typeof ensureHighlightsForDay>>,
      SurpriseRatingRow[],
      { views: number } | null
    ] = await Promise.all([
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
        : ratings.reduce(
            (acc: number, r: SurpriseRatingRow) => acc + r.stars,
            0
          ) / count;

    const reviews = ratings
      .map((r: SurpriseRatingRow) => ({
        id: r.id,
        stars: r.stars,
        review: r.review,
        createdAt: r.createdAt.toISOString(),
        likesCount: r.likes.length,
        likedByMe: user
          ? r.likes.some(
              (like: { id: string; userId: string | null }) =>
                like.userId === user.id
            )
          : false,
        isMine: user ? r.userId === user.id : false,
        authorLabel: r.user?.username
          ? `@${r.user.username}`
          : r.anonId
            ? getAnonLabel(r.anonId)
            : "User",
        replies: buildReplySummaries(r.replies, user),
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
        remaining: result.remaining,
        total: result.total,
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