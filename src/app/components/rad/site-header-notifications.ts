export type HeaderNotification = {
  id: string;
  type: "review_liked" | "review_replied" | "reply_liked";
  day: string | null;
  reviewId: string | null;
  replyId: string | null;
  isRead: boolean;
  createdAt: string;
  actorUsername: string;
  message: string;
};

type NotificationsResponse = {
  items: HeaderNotification[];
  unreadCount: number;
};

export const NOTIFICATIONS_MUTED_STORAGE_KEY = "rad:notifications-muted";
const NOTIFICATIONS_CLIENT_CACHE_TTL_MS = 12 * 1000;
export const NOTIFICATIONS_POLL_INTERVAL_MS = 30 * 1000;

type NotificationsClientCache = {
  userId: string;
  expiresAt: number;
  data: NotificationsResponse;
};

type NotificationsClientRequest = {
  userId: string;
  promise: Promise<NotificationsResponse | null>;
};

let notificationsClientCache: NotificationsClientCache | null = null;
let notificationsClientRequest: NotificationsClientRequest | null = null;

export function clearNotificationsClientCache() {
  notificationsClientCache = null;
  notificationsClientRequest = null;
}

export async function fetchNotificationsClientCached(
  userId: string,
  options: { force?: boolean } = {}
) {
  const now = Date.now();

  if (
    !options.force &&
    notificationsClientCache &&
    notificationsClientCache.userId === userId &&
    notificationsClientCache.expiresAt > now
  ) {
    return notificationsClientCache.data;
  }

  if (
    !options.force &&
    notificationsClientRequest &&
    notificationsClientRequest.userId === userId
  ) {
    return notificationsClientRequest.promise;
  }

  const request = (async () => {
    const res = await fetch("/api/notifications", {
      credentials: "include",
      cache: "no-store",
    });

    const data = (await res.json().catch(() => null)) as
      | NotificationsResponse
      | null;

    if (!res.ok || !data) {
      return null;
    }

    const payload: NotificationsResponse = {
      items: Array.isArray(data.items) ? data.items : [],
      unreadCount:
        typeof data.unreadCount === "number" ? data.unreadCount : 0,
    };

    notificationsClientCache = {
      userId,
      data: payload,
      expiresAt: Date.now() + NOTIFICATIONS_CLIENT_CACHE_TTL_MS,
    };

    return payload;
  })();

  notificationsClientRequest = {
    userId,
    promise: request,
  };

  try {
    return await request;
  } finally {
    if (notificationsClientRequest?.promise === request) {
      notificationsClientRequest = null;
    }
  }
}

export function buildNotificationHref(item: HeaderNotification) {
  const params = new URLSearchParams();

  if (item.day) {
    params.set("day", item.day);
  }

  if (item.reviewId) {
    params.set("reviewId", item.reviewId);
  }

  if (item.replyId) {
    params.set("replyId", item.replyId);
  }

  const targetId = item.replyId
    ? `reply-${item.replyId}`
    : item.reviewId
      ? `review-${item.reviewId}`
      : "";

  const query = params.toString();
  const hash = targetId ? `#${encodeURIComponent(targetId)}` : "";

  return query ? `/?${query}${hash}` : `/${hash}`;
}

export function formatNotificationTime(value: string) {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}
