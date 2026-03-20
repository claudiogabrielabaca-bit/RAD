import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { getAnonLabel } from "@/app/lib/anon-label";
import type { ReplyItem } from "@/app/lib/rad-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

type ReplyRecord = {
  id: string;
  ratingId: string;
  anonId: string | null;
  userId: string | null;
  parentReplyId: string | null;
  text: string;
  createdAt: Date;
  user: {
    username: string;
  } | null;
  likes: { id: string; userId: string | null }[];
  reports: { id: string; userId: string | null }[];
};

function buildReplyTree(replies: ReplyRecord[], user: CurrentUser): ReplyItem[] {
  const nodes = replies.map((reply) => ({
    id: reply.id,
    ratingId: reply.ratingId,
    parentReplyId: reply.parentReplyId,
    text: reply.text,
    createdAt: reply.createdAt.toISOString(),
    isMine: user ? reply.userId === user.id : false,
    authorLabel: reply.user?.username
      ? `@${reply.user.username}`
      : reply.anonId
        ? getAnonLabel(reply.anonId)
        : "User",
    likesCount: reply.likes.length,
    likedByMe: user ? reply.likes.some((like) => like.userId === user.id) : false,
    reportedByMe: user
      ? reply.reports.some((report) => report.userId === user.id)
      : false,
    replies: [] as ReplyItem[],
  }));

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots: ReplyItem[] = [];

  for (const node of nodes) {
    if (node.parentReplyId) {
      const parent = byId.get(node.parentReplyId);

      if (parent) {
        parent.replies.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  return roots;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
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
          replies: {
            orderBy: {
              createdAt: "asc",
            },
            include: {
              likes: true,
              reports: true,
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
        replies: buildReplyTree(r.replies as ReplyRecord[], user),
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