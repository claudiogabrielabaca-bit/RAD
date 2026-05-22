import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/current-user";
import { getAnonLabel } from "@/app/lib/anon-label";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";
import type { HighlightResponse, ReplyItem } from "@/app/lib/rad-types";

const DAY_BUNDLE_REVIEW_LIMIT = 50;
const DAY_BUNDLE_REPLY_LIMIT_PER_REVIEW = 25;
const VIEWER_RELATION_EMPTY_ID = "__rad_no_current_user__";
const ANONYMOUS_DAY_BUNDLE_CACHE_TTL_MS = 60 * 1000;
const SHOULD_LOG_DAY_BUNDLE_TIMINGS = process.env.NODE_ENV === "development";

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

type DayBundleReview = {
  id: string;
  stars: number;
  review: string;
  createdAt: string;
  likesCount: number;
  likedByMe: boolean;
  isMine: boolean;
  authorLabel: string;
  replies: ReplyItem[];
};

type DayBundlePayload = {
  day: string;
  dayData: {
    day: string;
    avg: number;
    count: number;
    views: number;
    reviews: DayBundleReview[];
  };
  highlightData: HighlightResponse;
  isFavoriteDay: boolean;
  favoriteDay: string | null;
};

type RatingSummaryRecord = {
  count: number;
  avg: number;
};

const anonymousDayBundleCache = new Map<
  string,
  {
    expiresAt: number;
    payload: DayBundlePayload;
  }
>();

const anonymousDayBundleRequests = new Map<string, Promise<DayBundlePayload>>();

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

async function measureBundleStep<T>(
  label: string,
  promise: Promise<T>,
  timings: Record<string, number>
): Promise<T> {
  const startedAt = Date.now();

  try {
    return await promise;
  } finally {
    timings[label] = Date.now() - startedAt;
  }
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

async function buildDayBundlePayload(
  day: string,
  user: CurrentUser
): Promise<DayBundlePayload> {
  const totalStartedAt = Date.now();
  const timings: Record<string, number> = {
    currentUser: 0,
  };

  const viewerScopedRelationSelect = buildViewerScopedRelationSelect(user);

  const [highlightResult, ratings, stats, favorite]: [
    Awaited<ReturnType<typeof ensureHighlightsForDay>>,
    RatingRecord[],
    { views: number } | null,
    { day: string } | null,
  ] = await Promise.all([
    measureBundleStep("highlight", ensureHighlightsForDay(day), timings),
    measureBundleStep(
      "ratings",
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
      timings
    ),
    measureBundleStep(
      "stats",
      prisma.dayStats.findUnique({
        where: { day },
        select: { views: true },
      }),
      timings
    ),
    measureBundleStep(
      "favorite",
      user
        ? prisma.favoriteDay.findUnique({
            where: {
              favorite_day_user_unique: {
                userId: user.id,
                day,
              },
            },
            select: {
              day: true,
            },
          })
        : Promise.resolve(null),
      timings
    ),
  ]);

  let count = ratings.length;
  let avg =
    ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length
      : 0;

  if (ratings.length >= DAY_BUNDLE_REVIEW_LIMIT) {
    const ratingSummaryRows = await measureBundleStep(
      "summary",
      prisma.$queryRaw<RatingSummaryRecord[]>`
        SELECT
          COUNT(*)::integer AS "count",
          COALESCE(AVG("stars")::double precision, 0) AS "avg"
        FROM "Rating"
        WHERE "day" = ${day}
      `,
      timings
    );

    const ratingSummary = ratingSummaryRows[0];
    count = ratingSummary?.count ?? count;
    avg = ratingSummary?.avg ?? avg;
  } else {
    timings.summary = 0;
  }

  const views = stats?.views ?? 0;

  const transformStartedAt = Date.now();

  const reviews = ratings
    .map((r: RatingRecord): DayBundleReview => ({
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

  timings.transform = Date.now() - transformStartedAt;
  timings.total = Date.now() - totalStartedAt;

  if (SHOULD_LOG_DAY_BUNDLE_TIMINGS) {
    console.info(
      `[day-bundle] ${day} total=${timings.total}ms currentUser=${timings.currentUser}ms highlight=${timings.highlight ?? 0}ms ratings=${timings.ratings ?? 0}ms summary=${timings.summary ?? 0}ms stats=${timings.stats ?? 0}ms favorite=${timings.favorite ?? 0}ms transform=${timings.transform}ms reviews=${ratings.length}`
    );
  }

  return {
    day,
    dayData: {
      day,
      avg,
      count,
      views,
      reviews,
    },
    highlightData: {
      highlight: highlightResult.highlight,
      highlights: highlightResult.highlights,
    },
    isFavoriteDay: !!favorite,
    favoriteDay: favorite?.day ?? null,
  };
}

async function getAnonymousDayBundle(day: string) {
  const now = Date.now();

  const cached = anonymousDayBundleCache.get(day);
  if (cached && cached.expiresAt > now) {
    if (SHOULD_LOG_DAY_BUNDLE_TIMINGS) {
      console.info(`[day-bundle-cache] ${day} hit`);
    }

    return cached.payload;
  }

  const pending = anonymousDayBundleRequests.get(day);
  if (pending) {
    if (SHOULD_LOG_DAY_BUNDLE_TIMINGS) {
      console.info(`[day-bundle-cache] ${day} pending`);
    }

    return pending;
  }

  const request = buildDayBundlePayload(day, null)
    .then((payload) => {
      anonymousDayBundleCache.set(day, {
        payload,
        expiresAt: Date.now() + ANONYMOUS_DAY_BUNDLE_CACHE_TTL_MS,
      });

      return payload;
    })
    .finally(() => {
      anonymousDayBundleRequests.delete(day);
    });

  anonymousDayBundleRequests.set(day, request);

  return request;
}

export async function buildPublicInitialDayBundle(day: string) {
  const highlightResult = await ensureHighlightsForDay(day);

  return {
    day,
    dayData: {
      day,
      avg: 0,
      count: 0,
      views: 0,
      reviews: [],
    },
    highlightData: {
      highlight: highlightResult.highlight,
      highlights: highlightResult.highlights,
    },
  };
}

export async function buildAnonymousDayBundle(day: string) {
  return getAnonymousDayBundle(day);
}

export async function buildDayBundle(day: string) {
  const currentUserStartedAt = Date.now();
  const user = await getCurrentUser();

  if (!user) {
    return getAnonymousDayBundle(day);
  }

  const payload = await buildDayBundlePayload(day, user);

  if (SHOULD_LOG_DAY_BUNDLE_TIMINGS) {
    console.info(
      `[day-bundle-user] ${day} currentUser=${Date.now() - currentUserStartedAt}ms`
    );
  }

  return payload;
}