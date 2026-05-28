import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { invalidateNotificationsCache } from "@/app/lib/notifications-cache";
import {
  createSoftRateLimiter,
  createTimingLogger,
  isPrismaError,
  runDeferredTask,
} from "@/app/lib/like-route-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const SHOULD_LOG_REVIEW_LIKE_TIMINGS = process.env.NODE_ENV === "development";
const SOFT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SOFT_RATE_LIMIT_LIMIT = 240;
const MAX_RATING_ID_LENGTH = 80;

type ReviewForNotification = {
  id: string;
  userId: string | null;
  day: string;
};

const runDeferredReviewLikeTask = (
  label: string,
  task: () => Promise<void>
) =>
  runDeferredTask({
    label,
    logLabel: "review-like-deferred",
    errorLabel: "review-like deferred",
    enabled: SHOULD_LOG_REVIEW_LIKE_TIMINGS,
    task,
  });

const consumeSoftRateLimit = createSoftRateLimiter({
  windowMs: SOFT_RATE_LIMIT_WINDOW_MS,
  limit: SOFT_RATE_LIMIT_LIMIT,
});

async function findReviewForNotification(ratingId: string) {
  return prisma.rating.findUnique({
    where: {
      id: ratingId,
    },
    select: {
      id: true,
      userId: true,
      day: true,
    },
  });
}

async function createReviewLikeNotification({
  review,
  actorUserId,
}: {
  review: ReviewForNotification;
  actorUserId: string;
}) {
  if (!review.userId || review.userId === actorUserId) {
    return;
  }

  await prisma.notification.create({
    data: {
      userId: review.userId,
      actorUserId,
      type: "review_liked",
      reviewId: review.id,
      day: review.day,
    },
  });

  invalidateNotificationsCache(review.userId);
}

async function deleteReviewLikeNotification({
  ratingId,
  actorUserId,
}: {
  ratingId: string;
  actorUserId: string;
}) {
  const notification = await prisma.notification.findFirst({
    where: {
      type: "review_liked",
      actorUserId,
      reviewId: ratingId,
    },
    select: {
      userId: true,
    },
  });

  await prisma.notification.deleteMany({
    where: {
      type: "review_liked",
      actorUserId,
      reviewId: ratingId,
    },
  });

  if (notification?.userId) {
    invalidateNotificationsCache(notification.userId);
  }
}

function scheduleReviewLikeNotification({
  ratingId,
  actorUserId,
  knownReview,
}: {
  ratingId: string;
  actorUserId: string;
  knownReview?: ReviewForNotification;
}) {
  runDeferredReviewLikeTask("notificationCreate", async () => {
    const review = knownReview ?? (await findReviewForNotification(ratingId));

    if (!review) {
      return;
    }

    await createReviewLikeNotification({
      review,
      actorUserId,
    });
  });
}

function scheduleReviewUnlikeNotification({
  ratingId,
  actorUserId,
}: {
  ratingId: string;
  actorUserId: string;
}) {
  runDeferredReviewLikeTask("notificationDelete", async () => {
    await deleteReviewLikeNotification({
      ratingId,
      actorUserId,
    });
  });
}

async function applyReviewLike({
  ratingId,
  userId,
  knownReview,
  timing,
}: {
  ratingId: string;
  userId: string;
  knownReview?: ReviewForNotification;
  timing: ReturnType<typeof createTimingLogger>;
}) {
  try {
    await prisma.ratingLike.create({
      data: {
        ratingId,
        userId,
        anonId: null,
      },
    });

    timing.mark("likeCreate");
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      timing.mark("likeExists");
      return {
        ok: true,
        notFound: false,
      };
    }

    if (isPrismaError(error, "P2003")) {
      timing.mark("likeMissingReview");
      return {
        ok: false,
        notFound: true,
      };
    }

    throw error;
  }

  scheduleReviewLikeNotification({
    ratingId,
    actorUserId: userId,
    knownReview,
  });
  timing.mark("notificationQueued");

  return {
    ok: true,
    notFound: false,
  };
}

async function applyReviewUnlike({
  ratingId,
  userId,
  timing,
}: {
  ratingId: string;
  userId: string;
  timing: ReturnType<typeof createTimingLogger>;
}) {
  const deleted = await prisma.ratingLike.deleteMany({
    where: {
      ratingId,
      userId,
    },
  });

  timing.mark(deleted.count > 0 ? "likeDelete" : "likeMissing");

  if (deleted.count > 0) {
    scheduleReviewUnlikeNotification({
      ratingId,
      actorUserId: userId,
    });
    timing.mark("notificationDeleteQueued");
  }

  return {
    ok: true,
  };
}

export async function POST(req: Request) {
  const timing = createTimingLogger("review-like", SHOULD_LOG_REVIEW_LIKE_TIMINGS);

  try {
    const body = await req.json().catch(() => null);
    const ratingId =
      typeof body?.ratingId === "string" ? body.ratingId.trim() : null;
    const desiredLiked =
      typeof body?.liked === "boolean" ? body.liked : null;
    timing.mark("body");

    if (!ratingId) {
      timing.log("status=400");
      return NextResponse.json(
        { error: "Missing ratingId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (ratingId.length > MAX_RATING_ID_LENGTH) {
      timing.log("status=400");
      return NextResponse.json(
        { error: "Invalid ratingId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const user = await getCurrentUser();
    timing.mark("currentUser");

    if (!user) {
      timing.log("status=401");
      return NextResponse.json(
        { error: "You must be logged in to like reviews." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (user.emailVerified === false) {
      timing.log("status=403");
      return NextResponse.json(
        { error: "You must verify your email to like reviews." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = consumeSoftRateLimit(user.id);
    timing.mark("softRateLimit");

    if (!rateLimit.ok) {
      timing.log("status=429");
      return NextResponse.json(
        { error: "Too many review like attempts. Please try again later." },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": String(rateLimit.retryAfterSec),
          },
        }
      );
    }

    if (desiredLiked === true) {
      const result = await applyReviewLike({
        ratingId,
        userId: user.id,
        timing,
      });

      if (result.notFound) {
        timing.log("status=404");
        return NextResponse.json(
          { error: "Review not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      timing.log("status=200 liked=true");

      return NextResponse.json(
        {
          ok: true,
          liked: true,
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    if (desiredLiked === false) {
      await applyReviewUnlike({
        ratingId,
        userId: user.id,
        timing,
      });

      timing.log("status=200 liked=false");

      return NextResponse.json(
        {
          ok: true,
          liked: false,
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const [review, existingLike] = await Promise.all([
      findReviewForNotification(ratingId),
      prisma.ratingLike.findUnique({
        where: {
          rating_like_user_unique: {
            ratingId,
            userId: user.id,
          },
        },
        select: {
          id: true,
        },
      }),
    ]);
    timing.mark("legacyRead");

    if (!review) {
      timing.log("status=404");
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (existingLike) {
      await applyReviewUnlike({
        ratingId,
        userId: user.id,
        timing,
      });

      timing.log("status=200 liked=false legacy");

      return NextResponse.json(
        {
          ok: true,
          liked: false,
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const result = await applyReviewLike({
      ratingId,
      userId: user.id,
      knownReview: review,
      timing,
    });

    if (result.notFound) {
      timing.log("status=404");
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    timing.log("status=200 liked=true legacy");

    return NextResponse.json(
      {
        ok: true,
        liked: true,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    timing.log("status=500");
    console.error("review-like POST error:", error);
    return NextResponse.json(
      {
        error: "Server error",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
