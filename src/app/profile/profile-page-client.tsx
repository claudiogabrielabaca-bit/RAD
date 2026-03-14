"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RatingDistribution from "@/app/components/rad/rating-distribution";

type ProfileUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
  createdAt: string;
};

type ProfileRating = {
  id: string;
  day: string;
  stars: number;
  review: string;
  createdAt: string;
  updatedAt: string;
};

type FavoritePreview = {
  type?: string | null;
  year?: number | null;
  title?: string | null;
  text?: string | null;
  image?: string | null;
  articleUrl?: string | null;
};

type FavoriteDay = {
  id: string;
  day: string;
  createdAt: string;
  updatedAt: string;
  preview: FavoritePreview | null;
};

type ProfileStats = {
  ratingsCount: number;
  favoritesCount: number;
  averageRating: number;
  starDistribution: {
    stars: number;
    count: number;
  }[];
};

type ProfilePayload = {
  user: ProfileUser;
  ratings: ProfileRating[];
  latestRatings: ProfileRating[];
  favoriteDays: FavoriteDay[];
  stats: ProfileStats;
};

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function formatDateOnly(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDayLabel(day: string) {
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

function renderStars(stars: number) {
  const safeStars = Math.max(0, Math.min(5, stars));
  return `${"★".repeat(safeStars)}${"☆".repeat(5 - safeStars)}`;
}

function fallbackFavoriteTitle(day: string) {
  return formatDayLabel(day);
}

function fallbackFavoriteText() {
  return "Explore this saved day on RAD and revisit what made it memorable.";
}

function getInitial(username?: string) {
  return username?.trim()?.[0]?.toUpperCase() ?? "?";
}

export default function ProfilePageClient() {
  const router = useRouter();

  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllRatings, setShowAllRatings] = useState(false);
  const [showAllFavorites, setShowAllFavorites] = useState(false);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/profile", {
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (res.status === 401) {
        router.push("/");
        return;
      }

      if (!res.ok) {
        setError(json?.error ?? "Could not load profile.");
        return;
      }

      setData(json);
    } catch {
      setError("Could not load profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const visibleFavorites = useMemo(() => {
    if (!data) return [];
    return showAllFavorites ? data.favoriteDays : data.favoriteDays.slice(0, 3);
  }, [data, showAllFavorites]);

  if (loading) {
    return (
      <main className="min-h-screen bg-transparent text-zinc-100">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="space-y-6">
            <div className="h-64 animate-pulse rounded-[32px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
            <div className="h-80 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
            <div className="h-80 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-transparent text-zinc-100">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-[28px] border border-red-400/20 bg-red-500/10 p-6 text-red-200">
            {error || "Could not load profile."}
          </div>
        </div>
      </main>
    );
  }

  const { user, stats, latestRatings, ratings, favoriteDays } = data;

  return (
    <main className="min-h-screen bg-transparent text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Your account
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Profile
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition hover:bg-black/30"
            >
              Back home
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Logout
            </button>
          </div>
        </div>

        {/* HERO */}
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col gap-5 md:flex-row">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-4xl font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                {getInitial(user.username)}
              </div>

              <div className="min-w-0">
                <div className="text-4xl font-semibold tracking-tight text-white">
                  @{user.username}
                </div>

                <div className="mt-1 text-sm text-zinc-400">{user.email}</div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
                    Joined {formatDateOnly(user.createdAt)}
                  </span>

                  {user.emailVerified ? (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                      Verified account
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
                      Email not verified
                    </span>
                  )}
                </div>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
                  @{user.username} is building a personal archive of favorite
                  moments in history.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Ratings
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {stats.ratingsCount}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Favorites
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {stats.favoritesCount}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Avg rating
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    ★ {stats.averageRating.toFixed(1)}
                  </div>
                </div>
              </div>

              <RatingDistribution
                compact
                avg={stats.averageRating.toFixed(1)}
                ratingsCount={stats.ratingsCount}
                starDistribution={stats.starDistribution}
              />
            </div>
          </div>
        </section>

        {/* FAVORITE DAYS */}
        <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Favorite days
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Days you marked with the star.
              </p>
            </div>

            {favoriteDays.length > 3 ? (
              <button
                type="button"
                onClick={() => setShowAllFavorites((prev) => !prev)}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition hover:bg-black/30"
              >
                {showAllFavorites ? "Show less" : "View all favorites"}
              </button>
            ) : null}
          </div>

          {favoriteDays.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
              You have not saved favorite days yet.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              {visibleFavorites.map((favorite) => {
                const title =
                  favorite.preview?.title?.trim() ||
                  fallbackFavoriteTitle(favorite.day);

                const description =
                  favorite.preview?.text?.trim() || fallbackFavoriteText();

                return (
                  <article
                    key={favorite.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {favorite.day}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Saved on {formatDateTime(favorite.updatedAt)}
                        </div>
                      </div>

                      <div className="text-lg text-yellow-400">★</div>
                    </div>

                    <div className="relative h-64 overflow-hidden">
                      {favorite.preview?.image ? (
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${favorite.preview.image})`,
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,#1a1a1a_0%,#0f0f0f_100%)]" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                          In this day
                        </div>

                        <div className="mt-1 text-xl font-semibold text-white">
                          {title}
                        </div>

                        <div className="mt-2 line-clamp-2 text-sm text-zinc-300">
                          {description}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/?day=${encodeURIComponent(favorite.day)}`}
                            className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-zinc-200"
                          >
                            Open on home
                          </Link>

                          {favorite.preview?.articleUrl ? (
                            <a
                              href={favorite.preview.articleUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 transition hover:bg-black/40"
                            >
                              Read source
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* LATEST REVIEWS */}
        <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Latest reviews
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Your 5 most recent ratings.
              </p>
            </div>

            {ratings.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllRatings((prev) => !prev)}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-zinc-200 transition hover:bg-black/30"
              >
                {showAllRatings ? "Hide full archive" : "Show full archive"}
              </button>
            ) : null}
          </div>

          {latestRatings.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
              You have not rated any day yet.
            </div>
          ) : (
            <div className="space-y-4">
              {latestRatings.map((rating) => (
                <article
                  key={rating.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">
                        {rating.day}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {renderStars(rating.stars)} • Updated{" "}
                        {formatDateTime(rating.updatedAt)}
                      </div>
                    </div>

                    <Link
                      href={`/?day=${encodeURIComponent(rating.day)}`}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10"
                    >
                      Open on home
                    </Link>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-zinc-300">
                    {rating.review?.trim()
                      ? rating.review
                      : "No written review for this rating."}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* FULL ARCHIVE */}
        {ratings.length > 5 ? (
          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Full archive
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Full history of the days you rated with your account.
                </p>
              </div>

              <div className="text-sm text-zinc-500">
                {ratings.length} total rating{ratings.length === 1 ? "" : "s"}
              </div>
            </div>

            {showAllRatings ? (
              <div className="space-y-4">
                {ratings.map((rating) => (
                  <article
                    key={rating.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white">
                          {rating.day}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {renderStars(rating.stars)} • Updated{" "}
                          {formatDateTime(rating.updatedAt)}
                        </div>
                      </div>

                      <Link
                        href={`/?day=${encodeURIComponent(rating.day)}`}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10"
                      >
                        Open on home
                      </Link>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-zinc-300">
                      {rating.review?.trim()
                        ? rating.review
                        : "No written review for this rating."}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
                Click <span className="text-zinc-200">Show full archive</span>{" "}
                to see all your ratings.
              </div>
            )}
          </section>
        ) : null}

        {/* ACCOUNT INFO */}
        <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">Account info</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Core account details.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Username
              </div>
              <div className="mt-2 text-sm text-white">@{user.username}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Email
              </div>
              <div className="mt-2 break-all text-sm text-white">
                {user.email}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Joined
              </div>
              <div className="mt-2 text-sm text-white">
                {formatDateOnly(user.createdAt)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                Status
              </div>
              <div className="mt-2 text-sm text-white">
                {user.emailVerified ? "Verified" : "Unverified"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
