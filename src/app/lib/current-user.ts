import { prisma } from "@/app/lib/prisma";
import { getSessionToken, hashSessionToken } from "@/app/lib/auth";

const CURRENT_USER_CACHE_TTL_MS = 60 * 1000;

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