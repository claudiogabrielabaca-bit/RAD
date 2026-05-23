import { prisma } from "@/app/lib/prisma";

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

export type NotificationItem = {
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

export type NotificationsPayload = {
  items: NotificationItem[];
  unreadCount: number;
};

type NotificationsCacheEntry = {
  payload: NotificationsPayload;
  expiresAt: number;
};

const notificationsCache = new Map<string, NotificationsCacheEntry>();
const pendingNotificationsByUserId = new Map<
  string,
  Promise<NotificationsPayload>
>();

let notificationsCacheSweepCounter = 0;

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

function setNotificationsCache(userId: string, payload: NotificationsPayload) {
  notificationsCache.set(userId, {
    payload,
    expiresAt: Date.now() + NOTIFICATIONS_CACHE_TTL_MS,
  });

  sweepExpiredNotificationsCache();
}

export function invalidateNotificationsCache(userId: string) {
  notificationsCache.delete(userId);
  pendingNotificationsByUserId.delete(userId);
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

export async function getNotificationsPayload(userId: string) {
  const now = Date.now();
  const cached = notificationsCache.get(userId);

  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const pending = pendingNotificationsByUserId.get(userId);

  if (pending) {
    return pending;
  }

  const pendingRequest = fetchNotificationsPayload(userId)
    .then((payload) => {
      setNotificationsCache(userId, payload);
      return payload;
    })
    .finally(() => {
      pendingNotificationsByUserId.delete(userId);
    });

  pendingNotificationsByUserId.set(userId, pendingRequest);

  return pendingRequest;
}
