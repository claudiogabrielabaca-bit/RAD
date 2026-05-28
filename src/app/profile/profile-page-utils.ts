export const BIO_MAX_LENGTH = 160;

export type ProfileUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
  createdAt: string;
  bio?: string | null;
};

export type ProfileRating = {
  id: string;
  day: string;
  stars: number;
  review: string;
  createdAt: string;
  updatedAt: string;
};

export type FavoritePreview = {
  type?: string | null;
  year?: number | null;
  title?: string | null;
  text?: string | null;
  image?: string | null;
  articleUrl?: string | null;
};

export type FavoriteDay = {
  id: string;
  day: string;
  createdAt: string;
  updatedAt: string;
  preview: FavoritePreview | null;
};

export type ProfileStats = {
  ratingsCount: number;
  favoritesCount: number;
  averageRating: number;
  starDistribution: {
    stars: number;
    count: number;
  }[];
};

export type ProfilePayload = {
  user: ProfileUser;
  ratings: ProfileRating[];
  latestRatings: ProfileRating[];
  favoriteDays: FavoriteDay[];
  stats: ProfileStats;
};

export function formatDateTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export function formatDateOnly(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDayLabel(day: string) {
  const [year, month, date] = day.split("-").map(Number);

  if (!year || !month || !date) return day;

  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString(
    undefined,
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }
  );
}

export function buildReviewDeepLink(day: string, reviewId: string) {
  const params = new URLSearchParams();

  params.set("day", day);
  params.set("reviewId", reviewId);

  return `/?${params.toString()}#review-${encodeURIComponent(reviewId)}`;
}

export function fallbackFavoriteTitle(day: string) {
  return formatDayLabel(day);
}

export function fallbackFavoriteText() {
  return "Explore this saved day on RAD and revisit what made it memorable.";
}

export function getInitial(username?: string) {
  return username?.trim()?.[0]?.toUpperCase() ?? "?";
}

export function getPreviewBadgeLabel(type?: string | null) {
  const normalized = type?.toLowerCase()?.trim();

  if (normalized === "birth") return "BIRTH";
  if (normalized === "death") return "DEATH";
  if (normalized === "event") return "EVENT";
  if (normalized === "discovery") return "DISCOVERY";

  return "SELECTED";
}

export function getPreviewBadgeClasses(type?: string | null) {
  const normalized = type?.toLowerCase()?.trim();

  if (normalized === "birth") {
    return "bg-emerald-300/18 text-emerald-200";
  }

  if (normalized === "death") {
    return "bg-rose-300/18 text-rose-200";
  }

  if (normalized === "event") {
    return "bg-sky-300/18 text-sky-200";
  }

  if (normalized === "discovery") {
    return "bg-zinc-200/12 text-zinc-100";
  }

  return "bg-amber-300/18 text-amber-200";
}

export function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function buildLoginRedirectPath(returnTo: string) {
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
  const hashIndex = safeReturnTo.indexOf("#");
  const beforeHash =
    hashIndex >= 0 ? safeReturnTo.slice(0, hashIndex) : safeReturnTo;
  const hash = hashIndex >= 0 ? safeReturnTo.slice(hashIndex) : "";
  const queryIndex = beforeHash.indexOf("?");
  const basePath =
    queryIndex >= 0 ? beforeHash.slice(0, queryIndex) || "/" : beforeHash || "/";
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);

  params.set("auth", "login");

  return `${basePath}?${params.toString()}${hash}`;
}

export function buildVerifyEmailRedirectPath(email: string) {
  const params = new URLSearchParams();

  params.set("auth", "verify-email");

  if (email.trim()) {
    params.set("email", email.trim().toLowerCase());
  }

  return `/?${params.toString()}`;
}
