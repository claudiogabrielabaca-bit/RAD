import { prisma } from "@/app/lib/prisma";
import { getSessionToken, hashSessionToken } from "@/app/lib/auth";

const CURRENT_USER_CACHE_TTL_MS = 60 * 1000;
const CURRENT_USER_CACHE_CLEANUP_EVERY_REQUESTS = 250;

let currentUserCacheCleanupCounter = 0;

type CurrentUser = {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  createdAt: Date;
  bio: string | null;
};

type CachedCurrentUser = {
  expiresAt: number;
  user: CurrentUser;
};

const currentUserCache = new Map<string, CachedCurrentUser>();
const currentUserRequests = new Map<string, Promise<CurrentUser | null>>();

function getCacheExpiry(sessionExpiresAt: Date) {
  return Math.min(
    Date.now() + CURRENT_USER_CACHE_TTL_MS,
    sessionExpiresAt.getTime()
  );
}

function maybeCleanupCurrentUserCache() {
  currentUserCacheCleanupCounter += 1;

  if (
    currentUserCacheCleanupCounter % CURRENT_USER_CACHE_CLEANUP_EVERY_REQUESTS !==
    0
  ) {
    return;
  }

  const now = Date.now();

  for (const [tokenHash, cached] of currentUserCache.entries()) {
    if (cached.expiresAt <= now) {
      currentUserCache.delete(tokenHash);
    }
  }
}

async function readCurrentUserFromSession(tokenHash: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          emailVerified: true,
          createdAt: true,
          bio: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session
      .delete({
        where: { id: session.id },
      })
      .catch(() => {});

    currentUserCache.delete(tokenHash);

    return null;
  }

  currentUserCache.set(tokenHash, {
    user: session.user,
    expiresAt: getCacheExpiry(session.expiresAt),
  });

  return session.user;
}

export async function getCurrentUser() {
  maybeCleanupCurrentUserCache();

  const token = await getSessionToken();

  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const cached = currentUserCache.get(tokenHash);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  const pending = currentUserRequests.get(tokenHash);

  if (pending) {
    return pending;
  }

  const request = readCurrentUserFromSession(tokenHash).finally(() => {
    currentUserRequests.delete(tokenHash);
  });

  currentUserRequests.set(tokenHash, request);

  return request;
}

export async function getCurrentUserWithin(timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return getCurrentUser();
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      getCurrentUser(),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
