"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RatingDistribution from "@/app/components/rad/rating-distribution";
import { useProfileBioEditor } from "@/app/hooks/use-profile-bio-editor";
import { useProfileData } from "@/app/hooks/use-profile-data";
import { PencilIcon, renderStars } from "@/app/profile/profile-page-parts";
import {
  BIO_MAX_LENGTH,
  buildReviewDeepLink,
  buildVerifyEmailRedirectPath,
  fallbackFavoriteText,
  fallbackFavoriteTitle,
  formatDateOnly,
  formatDateTime,
  getInitial,
  getPreviewBadgeClasses,
  getPreviewBadgeLabel,
  isValidDayString,
} from "@/app/profile/profile-page-utils";

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

  const { data, setData, loading, error } = useProfileData({
    returnTo,
  });
  const [showAllRatings, setShowAllRatings] = useState(false);
  const [showAllFavoriteDays, setShowAllFavoriteDays] = useState(false);

  const [expandedFavoriteCards, setExpandedFavoriteCards] = useState<Record<string, boolean>>({});


  const {
    bioModalOpen,
    bioDraft,
    bioSaving,
    bioError,
    displayedBio,
    openBioModal,
    closeBioModal,
    updateBioDraft,
    saveBio,
  } = useProfileBioEditor({
    data,
    setData,
  });

  function goToVerifyEmail() {
    const email = data?.user?.email ?? "";
    router.push(buildVerifyEmailRedirectPath(email));
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
  const displayedFavoriteDays = showAllFavoriteDays
    ? favoriteDays
    : favoriteDays.slice(0, 3);

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

          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.035] px-6 py-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-7 lg:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.035),transparent_24%)]" />

            <div className="relative grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
              <div className="min-w-0">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-5xl font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    {getInitial(user.username)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      RAD profile
                    </div>

                    <div className="mt-2 break-all text-5xl font-semibold tracking-tight text-white">
                      @{user.username}
                    </div>

                    <div className="mt-2 break-all text-sm text-zinc-400">
                      {user.email}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
                        Joined {formatDateOnly(user.createdAt)}
                      </span>

                      {user.emailVerified ? (
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                          Verified account
                        </span>
                      ) : (
                        <>
                          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
                            Email not verified
                          </span>

                          <button
                            type="button"
                            onClick={goToVerifyEmail}
                            className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-300/15 hover:text-amber-100"
                          >
                            Verify now
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex max-w-2xl items-start gap-3">
                  <p className="min-w-0 text-base leading-7 text-zinc-300">
                    {displayedBio}
                  </p>

                  <button
                    type="button"
                    onClick={openBioModal}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 transition hover:border-white/16 hover:bg-white/[0.06] hover:text-white"
                    aria-label="Edit bio"
                    title="Edit bio"
                  >
                    <PencilIcon />
                  </button>
                </div>

                <div className="mt-7 grid max-w-2xl gap-4 border-t border-white/8 pt-5 sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">
                      Identity
                    </div>
                    <div className="mt-2 text-sm leading-6 text-zinc-400">
                      A private RAD profile shaped by saved moments and ratings.
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-zinc-200">
                      Favorite focus
                    </div>
                    <div className="mt-2 text-sm leading-6 text-zinc-400">
                      Curated dates with personal meaning and replay value.
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-zinc-200">
                      Profile pulse
                    </div>
                    <div className="mt-2 text-sm leading-6 text-zinc-400">
                      A visual history of what you save, rate and revisit most.
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 xl:border-l xl:border-white/8 xl:pl-8">
                <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/8 pb-6">
                  <div className="px-2 text-center first:pl-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Ratings
                    </div>
                    <div className="mt-3 text-4xl font-semibold text-white">
                      {stats.ratingsCount}
                    </div>
                  </div>

                  <div className="px-2 text-center">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Favorites
                    </div>
                    <div className="mt-3 text-4xl font-semibold text-white">
                      {stats.favoritesCount}
                    </div>
                  </div>

                  <div className="px-2 text-center last:pr-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Avg rating
                    </div>
                    <div className="mt-3 text-4xl font-semibold text-white">
                      <span className="text-yellow-400">★</span>{" "}
                      {stats.averageRating.toFixed(1)}
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

          <section className="mt-8">
            <div className="mx-auto max-w-[980px]">
              <div className="mb-5">
              <h2 className="text-2xl font-semibold text-white">
                Favorite days
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Discovery-style cards for all the days you marked with the star.
              </p>
            </div>

              {favoriteDays.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                  <div className="text-sm font-medium text-zinc-200">
                    You have not saved favorite days yet.
                  </div>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                    Mark days with the star to build your personal collection of moments in history.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
                  >
                    Explore days
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-5">
                  {displayedFavoriteDays.map((favorite) => {
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

              {favoriteDays.length > 3 ? (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAllFavoriteDays((prev) => !prev)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/16 hover:bg-white/[0.055] hover:text-white"
                  >
                    {showAllFavoriteDays
                      ? "Show fewer favorite days"
                      : `Show all favorite days (${favoriteDays.length})`}
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                  className="rounded-2xl border border-white/10 bg-black/20 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/16 hover:bg-white/[0.055] hover:text-white"
                >
                  {showAllRatings ? "Hide full archive" : "Show full archive"}
                </button>
              ) : null}
            </div>

            {displayedRatings.length === 0 ? (
              <div className="border-t border-white/8 py-6">
                <div className="text-sm font-medium text-zinc-200">
                  You have not rated any day yet.
                </div>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                  Pick a day, leave a rating, and your review history will appear here.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
                >
                  Rate a day
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/8 border-t border-white/8">
                {displayedRatings.map((rating) => {
                  const hasWrittenReview = !!rating.review?.trim();

                  return (
                    <article
                      key={rating.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        router.push(buildReviewDeepLink(rating.day, rating.id))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(buildReviewDeepLink(rating.day, rating.id));
                        }
                      }}
                      className="group grid cursor-pointer gap-4 py-5 transition hover:bg-white/[0.025] sm:grid-cols-[minmax(190px,0.95fr)_minmax(0,1.35fr)_auto] sm:items-center sm:px-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xl font-semibold tracking-tight text-white">
                          {rating.day}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                          {renderStars(rating.stars)}
                          <span>
                            Updated {formatDateTime(rating.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 border-white/8 sm:border-l sm:pl-7">
                        <p
                          className={`break-words text-sm leading-6 [overflow-wrap:anywhere] ${
                            hasWrittenReview ? "text-zinc-200" : "text-zinc-500"
                          }`}
                        >
                          {hasWrittenReview
                            ? rating.review.trim()
                            : "No written review"}
                        </p>
                      </div>

                      <div className="flex items-center justify-start gap-3 sm:justify-end">
                        <span className="text-sm font-medium text-zinc-400 transition group-hover:text-zinc-200">
                          Open day
                        </span>
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-black/20 text-lg text-zinc-300 transition group-hover:border-white/22 group-hover:bg-white/[0.06] group-hover:text-white">
                          →
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>        </div>
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
                  onChange={(e) => updateBioDraft(e.target.value)}
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
