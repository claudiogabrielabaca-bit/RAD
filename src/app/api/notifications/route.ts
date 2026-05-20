import { prisma } from "@/app/lib/prisma";
import { getSessionToken, hashSessionToken } from "@/app/lib/auth";
import { getCurrentUser } from "@/app/lib/current-user";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const SHOULD_LOG_NOTIFICATIONS_TIMINGS = process.env.NODE_ENV === "development";
const NOTIFICATIONS_CACHE_TTL_MS = 15_000;

type NotificationRow = {
  id: string;
  type: string;
  day: string | null;
  reviewId: string | null;
  replyId: string | null;
  isRead: boolean;
  createdAt: Date;
  actorUser: {
    username: string;
  };
};

type NotificationItem = {
  id: string;
  type: string;
  day: string | null;
  reviewId: string | null;
  replyId: string | null;
  isRead: boolean;
  createdAt: string;
  actorUsername: string;
  message: string;
};

type NotificationsPayload = {
  items: NotificationItem[];
  unreadCount: number;
};

type NotificationsCacheEntry = {
  payload: NotificationsPayload;
  expiresAt: number;
};

const notificationsCache = new Map<string, NotificationsCacheEntry>();
const pendingNotificationsBySessionKey = new Map<
  string,
  Promise<NotificationsPayload | null>
>();

let notificationsCacheSweepCounter = 0;

function createTimingLogger(label: string) {
  const startedAt = Date.now();
  let lastAt = startedAt;
  const parts: string[] = [];

  function mark(step: string) {
    if (!SHOULD_LOG_NOTIFICATIONS_TIMINGS) return;

    const now = Date.now();
    parts.push(`${step}=${now - lastAt}ms`);
    lastAt = now;
  }

  function log(extra = "") {
    if (!SHOULD_LOG_NOTIFICATIONS_TIMINGS) return;

    const total = Date.now() - startedAt;
    const suffix = extra ? ` ${extra}` : "";
    console.log(`[${label}] ${parts.join(" ")} total=${total}ms${suffix}`);
  }

  return {
    mark,
    log,
  };
}

function formatMessage(type: string, username: string) {
  switch (type) {
    case "review_liked":
      return `@${username} liked your review`;
    case "review_replied":
      return `@${username} replied to your review`;
    case "reply_liked":
      return `@${username} liked your reply`;
    default:
      return `@${username} interacted with your content`;
  }
}

function sweepExpiredNotificationsCache() {
  notificationsCacheSweepCounter += 1;

  if (notificationsCacheSweepCounter % 100 !== 0) {
    return;
  }

  const now = Date.now();

  for (const [key, entry] of notificationsCache.entries()) {
    if (entry.expiresAt <= now) {
      notificationsCache.delete(key);
    }
  }
}

function setNotificationsCache(
  sessionKey: string,
  payload: NotificationsPayload
) {
  notificationsCache.set(sessionKey, {
    payload,
    expiresAt: Date.now() + NOTIFICATIONS_CACHE_TTL_MS,
  });

  sweepExpiredNotificationsCache();
}

async function fetchNotificationsPayload(userId: string) {
  const [notifications, unreadCount]: [NotificationRow[], number] =
    await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        select: {
          id: true,
          type: true,
          day: true,
          reviewId: true,
          replyId: true,
          isRead: true,
          createdAt: true,
          actorUser: {
            select: {
              username: true,
            },
          },
        },
      }),
      prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

  const items = notifications.map((item: NotificationRow) => ({
    id: item.id,
    type: item.type,
    day: item.day,
    reviewId: item.reviewId,
    replyId: item.replyId,
    isRead: item.isRead,
    createdAt: item.createdAt.toISOString(),
    actorUsername: item.actorUser.username,
    message: formatMessage(item.type, item.actorUser.username),
  }));

  return {
    items,
    unreadCount,
  };
}

async function createPendingNotificationsPayload({
  sessionKey,
  timing,
}: {
  sessionKey: string;
  timing: ReturnType<typeof createTimingLogger>;
}) {
  const user = await getCurrentUser();
  timing.mark("currentUser");

  if (!user) {
    return null;
  }

  const payload = await fetchNotificationsPayload(user.id);
  setNotificationsCache(sessionKey, payload);

  return payload;
}

async function getNotificationsPayload({
  sessionKey,
  timing,
}: {
  sessionKey: string;
  timing: ReturnType<typeof createTimingLogger>;
}) {
  const now = Date.now();
  const cached = notificationsCache.get(sessionKey);

  if (cached && cached.expiresAt > now) {
    timing.mark("cacheHit");
    return cached.payload;
  }

  const pending = pendingNotificationsBySessionKey.get(sessionKey);

  if (pending) {
    timing.mark("pendingHit");
    return pending;
  }

  const pendingRequest = createPendingNotificationsPayload({
    sessionKey,
    timing,
  }).finally(() => {
    pendingNotificationsBySessionKey.delete(sessionKey);
  });

  pendingNotificationsBySessionKey.set(sessionKey, pendingRequest);

  timing.mark("cacheMiss");

  return pendingRequest;
}

export async function GET() {
  const timing = createTimingLogger("notifications");

  try {
    const token = await getSessionToken();
    timing.mark("sessionToken");

    if (!token) {
      timing.log("status=401");
      return NextResponse.json(
        { error: "You must be logged in to view notifications." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const sessionKey = hashSessionToken(token);
    timing.mark("sessionKey");

    const payload = await getNotificationsPayload({
      sessionKey,
      timing,
    });
    timing.mark("payload");

    if (!payload) {
      timing.log("status=401");
      return NextResponse.json(
        { error: "You must be logged in to view notifications." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    timing.log("status=200");

    return NextResponse.json(payload, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    timing.log("status=500");
    console.error("notifications GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}