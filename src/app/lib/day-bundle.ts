import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/current-user";
import { getAnonLabel } from "@/app/lib/anon-label";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";
import type { ReplyItem } from "@/app/lib/rad-types";

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

type RatingRecord = {
  id: string;
  stars: number;
  review: string;
  createdAt: Date;
  anonId: string | null;
  userId: string | null;
  user: {
    username: string;
  } | null;
  likes: { id: string; userId: string | null }[];
  replies: ReplyRecord[];
};

function buildReplyTree(replies: ReplyRecord[], user: CurrentUser): ReplyItem[] {
  const nodes: ReplyItem[] = replies.map((reply: ReplyRecord) => ({
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
    likedByMe: user
      ? reply.likes.some(
          (like: { id: string; userId: string | null }) => like.userId === user.id
        )
      : false,
    reportedByMe: user
      ? reply.reports.some(
          (report: { id: string; userId: string | null }) =>
            report.userId === user.id
        )
      : false,
    replies: [] as ReplyItem[],
  }));

  const byId = new Map<string, ReplyItem>(
    nodes.map((node: ReplyItem) => [node.id, node])
  );
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

export async function buildDayBundle(day: string) {
  const [user, highlightResult, ratings, stats]: [
    CurrentUser,
    Awaited<ReturnType<typeof ensureHighlightsForDay>>,
    RatingRecord[],
    { views: number } | null
  ] = await Promise.all([
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
      : ratings.reduce(
          (acc: number, r: RatingRecord) => acc + r.stars,
          0
        ) / count;

  const reviews = ratings
    .map((r: RatingRecord) => ({
      id: r.id,
      stars: r.stars,
      review: r.review,
      createdAt: r.createdAt.toISOString(),
      likesCount: r.likes.length,
      likedByMe: user
        ? r.likes.some(
            (like: { id: string; userId: string | null }) => like.userId === user.id
          )
        : false,
      isMine: user ? r.userId === user.id : false,
      authorLabel: r.user?.username
        ? `@${r.user.username}`
        : r.anonId
          ? getAnonLabel(r.anonId)
          : "User",
      replies: buildReplyTree(r.replies, user),
    }))
    .sort((a, b) => {
      if (a.isMine && !b.isMine) return -1;
      if (!a.isMine && b.isMine) return 1;

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  return {
    day,
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
  };
}