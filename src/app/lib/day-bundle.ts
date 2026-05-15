import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/current-user";
import { getAnonLabel } from "@/app/lib/anon-label";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";
import type { ReplyItem } from "@/app/lib/rad-types";

const DAY_BUNDLE_REVIEW_LIMIT = 50;
const DAY_BUNDLE_REPLY_LIMIT_PER_REVIEW = 25;
const VIEWER_RELATION_EMPTY_ID = "__rad_no_current_user__";

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

type ViewerScopedRelationSelect = {
  where: {
    userId?: string;
    id?: string;
  };
  select: {
    id: true;
  };
  take: 1;
};

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
  likes: { id: string }[];
  reports: { id: string }[];
  _count: {
    likes: number;
  };
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
  likes: { id: string }[];
  replies: ReplyRecord[];
  _count: {
    likes: number;
  };
};

function buildViewerScopedRelationSelect(
  user: CurrentUser
): ViewerScopedRelationSelect {
  if (user) {
    return {
      where: {
        userId: user.id,
      },
      select: {
        id: true,
      },
      take: 1,
    };
  }

  return {
    where: {
      id: VIEWER_RELATION_EMPTY_ID,
    },
    select: {
      id: true,
    },
    take: 1,
  };
}

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
    likesCount: reply._count.likes,
    likedByMe: user ? reply.likes.length > 0 : false,
    reportedByMe: user ? reply.reports.length > 0 : false,
    replies: [],
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
  const user = await getCurrentUser();
  const viewerScopedRelationSelect = buildViewerScopedRelationSelect(user);

  const [highlightResult, ratings, ratingSummary, stats]: [
    Awaited<ReturnType<typeof ensureHighlightsForDay>>,
    RatingRecord[],
    {
      _count: {
        _all: number;
      };
      _avg: {
        stars: number | null;
      };
    },
    { views: number } | null,
  ] = await Promise.all([
    ensureHighlightsForDay(day),
    prisma.rating.findMany({
      where: { day },
      orderBy: { createdAt: "desc" },
      take: DAY_BUNDLE_REVIEW_LIMIT,
      select: {
        id: true,
        stars: true,
        review: true,
        createdAt: true,
        anonId: true,
        userId: true,
        likes: viewerScopedRelationSelect,
        _count: {
          select: {
            likes: true,
          },
        },
        replies: {
          orderBy: {
            createdAt: "asc",
          },
          take: DAY_BUNDLE_REPLY_LIMIT_PER_REVIEW,
          select: {
            id: true,
            ratingId: true,
            anonId: true,
            userId: true,
            parentReplyId: true,
            text: true,
            createdAt: true,
            likes: viewerScopedRelationSelect,
            reports: viewerScopedRelationSelect,
            _count: {
              select: {
                likes: true,
              },
            },
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
    prisma.rating.aggregate({
      where: { day },
      _count: {
        _all: true,
      },
      _avg: {
        stars: true,
      },
    }),
    prisma.dayStats.findUnique({
      where: { day },
      select: { views: true },
    }),
  ]);

  const count = ratingSummary._count._all;
  const avg = ratingSummary._avg.stars ?? 0;

  const reviews = ratings
    .map((r: RatingRecord) => ({
      id: r.id,
      stars: r.stars,
      review: r.review,
      createdAt: r.createdAt.toISOString(),
      likesCount: r._count.likes,
      likedByMe: user ? r.likes.length > 0 : false,
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
