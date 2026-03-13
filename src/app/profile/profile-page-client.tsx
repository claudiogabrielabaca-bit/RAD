"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type ProfileUser = {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  emailVerified?: boolean;
};

type ProfileRating = {
  id: string;
  day: string;
  stars: number;
  review: string;
  createdAt: string;
  updatedAt: string;
};

type ProfileFavoriteDay = {
  id: string;
  day: string;
  createdAt: string;
  updatedAt: string;
};

type ProfileResponse = {
  user: ProfileUser;
  ratings: ProfileRating[];
  favoriteDays: ProfileFavoriteDay[];
  stats: {
    ratingsCount: number;
    favoritesCount: number;
    averageRating: number;
  };
};

function formatAvg(n: number) {
  if (!n || Number.isNaN(n)) return "0.0";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function formatDate(date?: string) {
  if (!date) return "";
  return new Date(date).toLocaleString();
}

function hasReviewText(text?: string) {
  return !!text && text.trim().length > 0;
}

function formatJoinedDate(date?: string) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getProfileBio(username?: string) {
  if (!username) {
    return "History lover. Building a personal archive of rated days.";
  }

  return `@${username} is building a personal archive of favorite moments in history.`;
}

function isValidDay(value?: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function ProfilePage() {
  const searchParams = useSearchParams();

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [backHomeHref, setBackHomeHref] = useState("/");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/profile", {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          if (!cancelled) {
            setError(json?.error ?? "Could not load profile.");
            setData(null);
          }
          return;
        }

        if (!cancelled) {
          setData(json as ProfileResponse);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load profile.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fromDay = searchParams.get("fromDay");

    if (isValidDay(fromDay)) {
      setBackHomeHref(`/?day=${fromDay}`);
      return;
    }

    if (typeof window !== "undefined") {
      const savedDay = window.localStorage.getItem("rad:lastDay");

      if (isValidDay(savedDay)) {
        setBackHomeHref(`/?day=${savedDay}`);
        return;
      }
    }

    setBackHomeHref("/");
  }, [searchParams]);

  async function handleLogout() {
    try {
      setLoggingOut(true);

      const res = await fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        setError("Could not log out.");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Could not log out.");
    } finally {
      setLoggingOut(false);
    }
  }

  const joinedLabel = useMemo(() => {
    return formatJoinedDate(data?.user?.createdAt);
  }, [data?.user?.createdAt]);

  const recentRatings = useMemo(() => data?.ratings?.slice(0, 4) ?? [], [data?.ratings]);

  const recentFavorites = useMemo(
    () => data?.favoriteDays?.slice(0, 6) ?? [],
    [data?.favoriteDays]
  );

  return (
    <main className="min-h-screen bg-transparent text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              Your account
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Profile
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={backHomeHref}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
            >
              Back home
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-[26px] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-xl">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="animate-pulse">
                <div className="h-6 w-24 rounded bg-white/10" />
                <div className="mt-5 h-24 w-full rounded-3xl bg-white/10" />
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="h-20 rounded-2xl bg-white/10" />
                  <div className="h-20 rounded-2xl bg-white/10" />
                  <div className="h-20 rounded-2xl bg-white/10" />
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="h-72 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
              <div className="h-72 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
            </div>

            <div className="h-80 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
          </div>
        ) : !data ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6 text-sm text-zinc-300 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            You need to be logged in to view your profile.
          </div>
        ) : (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              <div className="relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.035),transparent_28%)]" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.04] to-transparent" />

                <div className="relative p-6 sm:p-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-4xl font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                        {data.user.username?.slice(0, 1).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                          RAD profile
                        </div>

                        <h2 className="mt-2 truncate text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                          @{data.user.username}
                        </h2>

                        <div className="mt-2 truncate text-sm text-zinc-400 sm:text-base">
                          {data.user.email}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-zinc-200 backdrop-blur-xl">
                            Joined {joinedLabel || "—"}
                          </span>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-xl ${
                              data.user.emailVerified === false
                                ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
                                : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                            }`}
                          >
                            {data.user.emailVerified === false
                              ? "Email not verified"
                              : "Verified account"}
                          </span>
                        </div>

                        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
                          {getProfileBio(data.user.username)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
                      <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center backdrop-blur-xl">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Ratings
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {data.stats.ratingsCount}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center backdrop-blur-xl">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Favorites
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {data.stats.favoritesCount}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center backdrop-blur-xl">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Avg rating
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          ★ {formatAvg(data.stats.averageRating)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                      <div className="text-sm font-medium text-white">Account status</div>
                      <div className="mt-2 text-sm text-zinc-400">
                        Private RAD profile with saved ratings and favorites.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                      <div className="text-sm font-medium text-white">Favorite focus</div>
                      <div className="mt-2 text-sm text-zinc-400">
                        Building a personal archive of memorable historical days.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                      <div className="text-sm font-medium text-white">Profile note</div>
                      <div className="mt-2 text-sm text-zinc-400">
                        Future update: editable bio, profile picture, achievements and more.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">Your ratings</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      The days you rated most recently.
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {data.ratings.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-400 backdrop-blur-xl">
                      You haven&apos;t rated any days yet.
                    </div>
                  ) : (
                    recentRatings.map((item) => (
                      <Link
                        key={item.id}
                        href={`/?day=${item.day}&focus=my-review`}
                        className="block rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-black/35 backdrop-blur-xl"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-sm font-semibold text-white">
                            {item.day}
                          </div>

                          <div className="text-yellow-400">
                            {"★".repeat(clamp(item.stars, 0, 5))}
                            <span className="text-zinc-600">
                              {"★".repeat(5 - clamp(item.stars, 0, 5))}
                            </span>
                          </div>

                          <div className="text-xs text-zinc-500">
                            Updated {formatDate(item.updatedAt)}
                          </div>

                          <div className="ml-auto rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
                            Open on home
                          </div>
                        </div>

                        {hasReviewText(item.review) ? (
                          <div className="mt-3 text-sm leading-6 text-zinc-300">
                            {item.review}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-zinc-500">
                            No written review.
                          </div>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">Favorite days</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      Days you marked with the star.
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {data.favoriteDays.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-400 backdrop-blur-xl">
                      No favorite days yet.
                    </div>
                  ) : (
                    recentFavorites.map((item) => (
                      <Link
                        key={item.id}
                        href={`/?day=${item.day}`}
                        className="block rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-black/35 backdrop-blur-xl"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {item.day}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Saved on {formatDate(item.updatedAt)}
                            </div>
                          </div>

                          <div className="text-xl text-yellow-300">★</div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">All ratings</div>
                  <div className="mt-1 text-sm text-zinc-400">
                    Full history of the days you rated with your account.
                  </div>
                </div>

                <div className="text-sm text-zinc-500">
                  {data.ratings.length} total rating{data.ratings.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {data.ratings.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-400 backdrop-blur-xl">
                    You haven&apos;t rated any days yet.
                  </div>
                ) : (
                  data.ratings.map((item) => (
                    <Link
                      key={item.id}
                      href={`/?day=${item.day}&focus=my-review`}
                      className="block rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-black/35 backdrop-blur-xl"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-sm font-semibold text-white">
                          {item.day}
                        </div>

                        <div className="text-yellow-400">
                          {"★".repeat(clamp(item.stars, 0, 5))}
                          <span className="text-zinc-600">
                            {"★".repeat(5 - clamp(item.stars, 0, 5))}
                          </span>
                        </div>

                        <div className="text-xs text-zinc-500">
                          Updated {formatDate(item.updatedAt)}
                        </div>

                        <div className="ml-auto rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
                          Open on home
                        </div>
                      </div>

                      {hasReviewText(item.review) ? (
                        <div className="mt-3 text-sm leading-6 text-zinc-300">
                          {item.review}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-zinc-500">
                          No written review.
                        </div>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="text-lg font-semibold text-white">Account settings</div>
              <div className="mt-1 text-sm text-zinc-400">
                V1 private profile. Next step: edit username, change password, bio and avatar.
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl">
                  <div className="text-sm font-medium text-white">Username</div>
                  <div className="mt-2 text-sm text-zinc-400">
                    @{data.user.username}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl">
                  <div className="text-sm font-medium text-white">Email</div>
                  <div className="mt-2 truncate text-sm text-zinc-400">
                    {data.user.email}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl">
                  <div className="text-sm font-medium text-white">Joined</div>
                  <div className="mt-2 text-sm text-zinc-400">
                    {joinedLabel || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl">
                  <div className="text-sm font-medium text-white">Status</div>
                  <div className="mt-2 text-sm text-zinc-400">
                    {data.user.emailVerified === false ? "Not verified" : "Verified"}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}