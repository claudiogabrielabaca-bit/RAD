"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RatingDistribution from "@/app/components/rad/rating-distribution";

const BIO_MAX_LENGTH = 160;

type ProfileUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
  createdAt: string;
  bio?: string | null;
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

function getPreviewBadgeLabel(type?: string | null) {
  const normalized = type?.toLowerCase()?.trim();

  if (normalized === "birth") return "BIRTH";
  if (normalized === "death") return "DEATH";
  if (normalized === "event") return "EVENT";
  if (normalized === "discovery") return "DISCOVERY";

  return "SELECTED";
}

function getPreviewBadgeClasses(type?: string | null) {
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

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

export default function ProfilePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawReturnTo = searchParams.get("returnTo");
  const rawFromDay = searchParams.get("fromDay");

  const returnTo =
    rawReturnTo && rawReturnTo.startsWith("/")
      ? rawReturnTo
      : isValidDayString(rawFromDay)
        ? `/?day=${rawFromDay}`
        : "/";

  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllRatings, setShowAllRatings] = useState(false);

  const [bioModalOpen, setBioModalOpen] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState("");
  const [expandedFavoriteCards, setExpandedFavoriteCards] = useState<Record<string, boolean>>({});

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/profile", {
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (res.status === 401) {
        router.push(returnTo);
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

  useEffect(() => {
    loadProfile();
  }, [returnTo]);

  function getDisplayedBio() {
    const raw = data?.user?.bio?.trim();
    if (raw) return raw;
    return `@${data?.user.username ?? "user"} is building a personal archive of favorite moments in history.`;
  }

  function openBioModal() {
    setBioDraft(data?.user?.bio ?? "");
    setBioError("");
    setBioModalOpen(true);
  }

  function closeBioModal() {
    if (bioSaving) return;
    setBioModalOpen(false);
    setBioError("");
  }

  async function saveBio() {
    setBioSaving(true);
    setBioError("");

    try {
      const res = await fetch("/api/profile/bio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bio: bioDraft,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setBioError(json?.error ?? "Could not save bio.");
        return;
      }

      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          user: {
            ...prev.user,
            bio: json?.bio ?? "",
          },
        };
      });

      setBioModalOpen(false);
    } catch {
      setBioError("Could not save bio.");
    } finally {
      setBioSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-transparent text-zinc-100">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="space-y-6">
            <div className="h-72 animate-pulse rounded-[36px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
            <div className="h-[28rem] animate-pulse rounded-[30px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
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
  const displayedRatings = showAllRatings ? ratings : latestRatings;

  return (
    <>
      <main className="min-h-screen bg-transparent text-zinc-100">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Your account
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Profile
            </h1>
          </div>

          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.04),transparent_24%)]" />

            <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="flex flex-col gap-5 lg:flex-row">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-5xl font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {getInitial(user.username)}
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    RAD profile
                  </div>

                  <div className="mt-2 text-5xl font-semibold tracking-tight text-white">
                    @{user.username}
                  </div>

                  <div className="mt-2 text-sm text-zinc-400">{user.email}</div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
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

                  <div className="mt-5 inline-flex max-w-2xl items-center gap-3 align-middle">
                    <p className="max-w-[720px] text-base leading-7 text-zinc-300">
                      {getDisplayedBio()}
                    </p>

                    <button
                      type="button"
                      onClick={openBioModal}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-300 transition hover:bg-black/30 hover:text-white"
                      aria-label="Edit bio"
                      title="Edit bio"
                    >
                      <PencilIcon />
                    </button>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:max-w-2xl xl:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs font-medium text-zinc-200">
                        Identity
                      </div>
                      <div className="mt-2 text-sm leading-6 text-zinc-400">
                        A private RAD profile shaped by saved moments and
                        ratings.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs font-medium text-zinc-200">
                        Favorite focus
                      </div>
                      <div className="mt-2 text-sm leading-6 text-zinc-400">
                        Curated dates with personal meaning and replay value.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-2 xl:col-span-1">
                      <div className="text-xs font-medium text-zinc-200">
                        Profile pulse
                      </div>
                      <div className="mt-2 text-sm leading-6 text-zinc-400">
                        A visual history of what you save, rate and revisit
                        most.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Ratings
                    </div>
                    <div className="mt-3 text-4xl font-semibold text-white">
                      {stats.ratingsCount}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Favorites
                    </div>
                    <div className="mt-3 text-4xl font-semibold text-white">
                      {stats.favoritesCount}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Avg rating
                    </div>
                    <div className="mt-3 text-4xl font-semibold text-white">
                      ★ {stats.averageRating.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/25 p-4">
                  <RatingDistribution
                    compact
                    avg={stats.averageRating.toFixed(1)}
                    ratingsCount={stats.ratingsCount}
                    starDistribution={stats.starDistribution}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-white">
                Favorite days
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Discovery-style cards for all the days you marked with the star.
              </p>
            </div>

            {favoriteDays.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
                You have not saved favorite days yet.
              </div>
            ) : (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {favoriteDays.map((favorite) => {
                  const title =
                    favorite.preview?.title?.trim() ||
                    fallbackFavoriteTitle(favorite.day);

                  const description =
                    favorite.preview?.text?.trim() || fallbackFavoriteText();

                  const badgeLabel = getPreviewBadgeLabel(
                    favorite.preview?.type
                  );
                  const badgeClasses = getPreviewBadgeClasses(
                    favorite.preview?.type
                  );

                  const isExpanded = !!expandedFavoriteCards[favorite.id];

                  return (
                    <article
                      key={favorite.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        router.push(`/?day=${encodeURIComponent(favorite.day)}`)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/?day=${encodeURIComponent(favorite.day)}`);
                        }
                      }}
                      className="group relative h-[430px] min-w-[290px] max-w-[290px] cursor-pointer overflow-hidden rounded-[30px] border border-white/10 bg-black/30"
                    >
                      {favorite.preview?.image ? (
                        <div
                          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.04]"
                          style={{
                            backgroundImage: `url(${favorite.preview.image})`,
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,#1a1a1a_0%,#0d0d0d_100%)]" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                      <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                        <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-md">
                          Favorite
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur-md ${badgeClasses}`}
                        >
                          {badgeLabel}
                        </span>
                      </div>

                      <div
                        className={`absolute bottom-4 left-4 right-4 rounded-[26px] border border-white/10 bg-[rgba(17,17,17,0.78)] shadow-[0_20px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all ${
                          isExpanded ? "p-5" : "p-4"
                        }`}
                      >
                        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                          {favorite.day}
                        </div>

                        <div
                          className={`mt-2 font-semibold leading-[1.05] tracking-tight text-white ${
                            isExpanded ? "text-[2rem]" : "text-[1.65rem]"
                          }`}
                        >
                          {title}
                        </div>

                        <div
                          className={`mt-3 text-sm leading-6 text-zinc-300 ${
                            isExpanded ? "" : "line-clamp-2"
                          }`}
                        >
                          {description}
                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                          <span>Saved {formatDateOnly(favorite.updatedAt)}</span>
                          <span className="text-yellow-400">★</span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedFavoriteCards((prev) => ({
                                ...prev,
                                [favorite.id]: !prev[favorite.id],
                              }));
                            }}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-white/10"
                          >
                            {isExpanded ? "Read less" : "Read more"}
                          </button>

                          {favorite.preview?.articleUrl ? (
                            <a
                              href={favorite.preview.articleUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 transition hover:bg-black/40"
                            >
                              Read source
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  {showAllRatings ? "Full archive" : "Latest reviews"}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {showAllRatings
                    ? `Full history of the days you rated with your account. ${ratings.length} total rating${ratings.length === 1 ? "" : "s"}.`
                    : "Your 5 most recent ratings."}
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

            {displayedRatings.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-400">
                You have not rated any day yet.
              </div>
            ) : (
              <div className="space-y-4">
                {displayedRatings.map((rating) => (
                  <article
                    key={rating.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/?day=${encodeURIComponent(rating.day)}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/?day=${encodeURIComponent(rating.day)}`);
                      }
                    }}
                    className="cursor-pointer rounded-2xl border border-white/10 bg-black/20 p-4"
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
        </div>
      </main>

      {bioModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div
            className="absolute inset-0"
            onClick={closeBioModal}
            aria-hidden="true"
          />

          <div className="relative z-[101] w-full max-w-lg overflow-hidden rounded-[30px] border border-white/10 bg-[#121212]/95 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_26%)]" />

            <div className="relative p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    RAD Profile
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    Edit bio
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
                    Update the text shown under your profile.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeBioModal}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="mt-6">
                <label className="mb-2 block text-sm text-zinc-300">Bio</label>
                <textarea
                  value={bioDraft}
                  onChange={(e) =>
                    setBioDraft(e.target.value.slice(0, BIO_MAX_LENGTH))
                  }
                  maxLength={BIO_MAX_LENGTH}
                  placeholder={`@${user.username} is building a personal archive of favorite moments in history.`}
                  className="h-36 w-full resize-none rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />

                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500">
                    {bioDraft.length} / {BIO_MAX_LENGTH}
                  </div>

                  {bioError ? (
                    <div className="text-xs text-red-300">{bioError}</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveBio}
                  disabled={bioSaving}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {bioSaving ? "Saving..." : "Save bio"}
                </button>

                <button
                  type="button"
                  onClick={closeBioModal}
                  disabled={bioSaving}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}