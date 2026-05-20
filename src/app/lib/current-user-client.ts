import type {
  CurrentUser,
  CurrentUserResponse,
} from "@/app/lib/home-page-auth";

const CURRENT_USER_CLIENT_CACHE_TTL_MS = 10 * 1000;

type CurrentUserClientCache = {
  expiresAt: number;
  user: CurrentUser;
};

let currentUserClientCache: CurrentUserClientCache | null = null;
let currentUserClientRequest: Promise<CurrentUser> | null = null;

export function setCurrentUserClientCache(user: CurrentUser) {
  currentUserClientCache = {
    user,
    expiresAt: Date.now() + CURRENT_USER_CLIENT_CACHE_TTL_MS,
  };
}

export function clearCurrentUserClientCache() {
  currentUserClientCache = null;
  currentUserClientRequest = null;
}

export async function fetchCurrentUserClientCached(
  options: { force?: boolean } = {}
) {
  if (
    !options.force &&
    currentUserClientCache &&
    currentUserClientCache.expiresAt > Date.now()
  ) {
    return currentUserClientCache.user;
  }

  if (!options.force && currentUserClientRequest) {
    return currentUserClientRequest;
  }

  const request = (async () => {
    const res = await fetch("/api/me", {
      credentials: "include",
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as
      | CurrentUserResponse
      | null;

    if (!res.ok) {
      setCurrentUserClientCache(null);
      return null;
    }

    const user = json?.user ?? null;
    setCurrentUserClientCache(user);

    return user;
  })();

  currentUserClientRequest = request;

  try {
    return await request;
  } finally {
    if (currentUserClientRequest === request) {
      currentUserClientRequest = null;
    }
  }
}
