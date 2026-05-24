import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { invalidateNotificationsCache } from "@/app/lib/notifications-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const SHOULD_LOG_REPLY_LIKE_TIMINGS = process.env.NODE_ENV === "development";
const SOFT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SOFT_RATE_LIMIT_LIMIT = 240;
const MAX_REPLY_ID_LENGTH = 80;

type PrismaErrorCode = "P2002" | "P2003";

type SoftRateLimitBucket = {
  count: number;
  expiresAt: number;
};

type ReplyForNotification = {
  id: string;
  userId: string | null;
  ratingId: string;
  rating: {
    day: string;
  };
};

const softRateLimitBuckets = new Map<string, SoftRateLimitBucket>();
let softRateLimitSweepCounter = 0;

function createTimingLogger(label: string) {
  const startedAt = Date.now();
  let lastAt = startedAt;
  const parts: string[] = [];

  function mark(step: string) {
    if (!SHOULD_LOG_REPLY_LIKE_TIMINGS) return;

    const now = Date.now();
    parts.push(`${step}=${now - lastAt}ms`);
    lastAt = now;
  }

  function log(extra = "") {
    if (!SHOULD_LOG_REPLY_LIKE_TIMINGS) return;

    const total = Date.now() - startedAt;
    const suffix = extra ? ` ${extra}` : "";
    console.log(`[${label}] ${parts.join(" ")} total=${total}ms${suffix}`);
  }

  return {
    mark,
    log,
  };
}

function logDeferredTask(label: string, startedAt: number, status: string) {
  if (!SHOULD_LOG_REPLY_LIKE_TIMINGS) return;

  console.log(
    `[reply-like-deferred] ${label}=${Date.now() - startedAt}ms status=${status}`
  );
}

function runDeferredReplyLikeTask(
  label: string,
  task: () => Promise<void>
) {
  const startedAt = Date.now();

  void (async () => {
    try {
      await task();
      logDeferredTask(label, startedAt, "ok");
    } catch (error) {
      logDeferredTask(label, startedAt, "error");
      console.error(`reply-like deferred ${label} error:`, error);
    }
  })();
}

function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

function isPrismaError(error: unknown, code: PrismaErrorCode) {
  return getPrismaErrorCode(error) === code;
}

function consumeSoftRateLimit(key: string) {
  const now = Date.now();

  softRateLimitSweepCounter += 1;

  if (softRateLimitSweepCounter % 250 === 0) {
    for (const [bucketKey, bucket] of softRateLimitBuckets.entries()) {
      if (bucket.expiresAt <= now) {
        softRateLimitBuckets.delete(bucketKey);
      }
    }
  }

  const existing = softRateLimitBuckets.get(key);

  if (!existing || existing.expiresAt <= now) {
    softRateLimitBuckets.set(key, {
      count: 1,
      expiresAt: now + SOFT_RATE_LIMIT_WINDOW_MS,
    });

    return {
      ok: true,
      retryAfterSec: 0,
    };
  }

  if (existing.count >= SOFT_RATE_LIMIT_LIMIT) {
    return {
      ok: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((existing.expiresAt - now) / 1000)
      ),
    };
  }

  existing.count += 1;
  softRateLimitBuckets.set(key, existing);

  return {
    ok: true,
    retryAfterSec: 0,
  };
}

async function findReplyForNotification(replyId: string) {
  return prisma.ratingReply.findUnique({
    where: {
      id: replyId,
    },
    select: {
      id: true,
      userId: true,
      ratingId: true,
      rating: {
        select: {
          day: true,
        },
      },
    },
  });
}

async function createReplyLikeNotification({
  reply,
  actorUserId,
}: {
  reply: ReplyForNotification;
  actorUserId: string;
}) {
  if (!reply.userId || reply.userId === actorUserId) {
    return;
  }

  await prisma.notification.create({
    data: {
      userId: reply.userId,
      actorUserId,
      type: "reply_liked",
      reviewId: reply.ratingId,
      replyId: reply.id,
      day: reply.rating.day,
    },
  });

  invalidateNotificationsCache(reply.userId);
}

async function deleteReplyLikeNotification({
  replyId,
  actorUserId,
}: {
  replyId: string;
  actorUserId: string;
}) {
  const notification = await prisma.notification.findFirst({
    where: {
      type: "reply_liked",
      actorUserId,
      replyId,
    },
    select: {
      userId: true,
    },
  });

  await prisma.notification.deleteMany({
    where: {
      type: "reply_liked",
      actorUserId,
      replyId,
    },
  });

  if (notification?.userId) {
    invalidateNotificationsCache(notification.userId);
  }
}

function scheduleReplyLikeNotification({
  replyId,
  actorUserId,
  knownReply,
}: {
  replyId: string;
  actorUserId: string;
  knownReply?: ReplyForNotification;
}) {
  runDeferredReplyLikeTask("notificationCreate", async () => {
    const reply = knownReply ?? (await findReplyForNotification(replyId));

    if (!reply) {
      return;
    }

    await createReplyLikeNotification({
      reply,
      actorUserId,
    });
  });
}

function scheduleReplyUnlikeNotification({
  replyId,
  actorUserId,
}: {
  replyId: string;
  actorUserId: string;
}) {
  runDeferredReplyLikeTask("notificationDelete", async () => {
    await deleteReplyLikeNotification({
      replyId,
      actorUserId,
    });
  });
}

async function applyReplyLike({
  replyId,
  userId,
  knownReply,
  timing,
}: {
  replyId: string;
  userId: string;
  knownReply?: ReplyForNotification;
  timing: ReturnType<typeof createTimingLogger>;
}) {
  try {
    await prisma.replyLike.create({
      data: {
        replyId,
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
      timing.mark("likeMissingReply");
      return {
        ok: false,
        notFound: true,
      };
    }

    throw error;
  }

  scheduleReplyLikeNotification({
    replyId,
    actorUserId: userId,
    knownReply,
  });
  timing.mark("notificationQueued");

  return {
    ok: true,
    notFound: false,
  };
}

async function applyReplyUnlike({
  replyId,
  userId,
  timing,
}: {
  replyId: string;
  userId: string;
  timing: ReturnType<typeof createTimingLogger>;
}) {
  const deleted = await prisma.replyLike.deleteMany({
    where: {
      replyId,
      userId,
    },
  });

  timing.mark(deleted.count > 0 ? "likeDelete" : "likeMissing");

  if (deleted.count > 0) {
    scheduleReplyUnlikeNotification({
      replyId,
      actorUserId: userId,
    });
    timing.mark("notificationDeleteQueued");
  }

  return {
    ok: true,
  };
}

export async function POST(req: Request) {
  const timing = createTimingLogger("reply-like");

  try {
    const body = await req.json().catch(() => null);
    const replyId =
      typeof body?.replyId === "string" ? body.replyId.trim() : null;
    const desiredLiked =
      typeof body?.liked === "boolean" ? body.liked : null;
    timing.mark("body");

    if (!replyId) {
      timing.log("status=400");
      return NextResponse.json(
        { error: "Missing replyId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (replyId.length > MAX_REPLY_ID_LENGTH) {
      timing.log("status=400");
      return NextResponse.json(
        { error: "Invalid replyId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const user = await getCurrentUser();
    timing.mark("currentUser");

    if (!user) {
      timing.log("status=401");
      return NextResponse.json(
        { error: "You must be logged in to like replies." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (user.emailVerified === false) {
      timing.log("status=403");
      return NextResponse.json(
        { error: "You must verify your email to like replies." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = consumeSoftRateLimit(user.id);
    timing.mark("softRateLimit");

    if (!rateLimit.ok) {
      timing.log("status=429");
      return NextResponse.json(
        { error: "Too many reply like attempts. Please try again later." },
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
      const result = await applyReplyLike({
        replyId,
        userId: user.id,
        timing,
      });

      if (result.notFound) {
        timing.log("status=404");
        return NextResponse.json(
          { error: "Reply not found" },
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
      await applyReplyUnlike({
        replyId,
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

    const [reply, existingLike] = await Promise.all([
      findReplyForNotification(replyId),
      prisma.replyLike.findUnique({
        where: {
          reply_like_user_unique: {
            replyId,
            userId: user.id,
          },
        },
        select: {
          id: true,
        },
      }),
    ]);
    timing.mark("legacyRead");

    if (!reply) {
      timing.log("status=404");
      return NextResponse.json(
        { error: "Reply not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (existingLike) {
      await applyReplyUnlike({
        replyId,
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

    const result = await applyReplyLike({
      replyId,
      userId: user.id,
      knownReply: reply,
      timing,
    });

    if (result.notFound) {
      timing.log("status=404");
      return NextResponse.json(
        { error: "Reply not found" },
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
    console.error("reply-like POST error:", error);
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
