import type React from "react";
import ReplyList from "@/app/components/rad/reply-list";
import ReplyComposer from "@/app/components/rad/reply-composer";
import ReviewActionsMenu from "@/app/components/rad/review-actions-menu";
import { Star } from "@/app/components/rad/discover-day-card";
import {
  clamp,
  formatReviewDate,
  hasReviewText,
  isLongReview,
} from "@/app/lib/home-page-utils";
import type { DayResponse } from "@/app/lib/rad-types";
import type { AuthView } from "@/app/components/rad/auth-modal";
import type { CurrentUser } from "@/app/lib/home-page-auth";

type ReviewItem = DayResponse["reviews"][number];

type HomeReactionsPanelProps = {
  rateBoxRef: React.RefObject<HTMLDivElement | null>;
  myReviewBlockRef: React.RefObject<HTMLDivElement | null>;
  targetReviewId: string | null;
  myReview: ReviewItem | null;
  shownStars: number;
  review: string;
  saving: boolean;
  toast: string;
  reviewsSort: "helpful" | "newest";
  expandedReviews: Record<string, boolean>;
  deletingReviewId: string | null;
  deletingReplyId: string | null;
  replyingToId: string | null;
  replyTextByRating: Record<string, string>;
  sendingReplyId: string | null;
  reportingReviewId: string | null;
  otherReviews: ReviewItem[];
  sortedOtherReviews: ReviewItem[];
  loadingDay: boolean;
  currentUser: CurrentUser;
  reviewMaxLength: number;
  onSetHoverStars: React.Dispatch<React.SetStateAction<number>>;
  onSetStars: React.Dispatch<React.SetStateAction<number>>;
  onSetReview: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
  onSetReviewsSort: React.Dispatch<React.SetStateAction<"helpful" | "newest">>;
  onSetSocialPostOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenDeleteReviewModal: (id: string) => void;
  onSetExpandedReviews: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  onToggleLike: (ratingId: string) => void;
  onOpenAuthModal: (view?: AuthView, nextEmail?: string) => void;
  onRequireVerifiedEmail: () => boolean;
  onSetReplyingToId: React.Dispatch<React.SetStateAction<string | null>>;
  onOpenDeleteReplyModal: (replyId: string) => void;
  onRequireReplyInteraction: () => boolean;
  onSetReplyTextByRating: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  onSubmitReply: (ratingId: string) => void;
  onReportReview: (ratingId: string) => void;
};

export default function HomeReactionsPanel({
  rateBoxRef,
  myReviewBlockRef,
  targetReviewId,
  myReview,
  shownStars,
  review,
  saving,
  toast,
  reviewsSort,
  expandedReviews,
  deletingReviewId,
  deletingReplyId,
  replyingToId,
  replyTextByRating,
  sendingReplyId,
  reportingReviewId,
  otherReviews,
  sortedOtherReviews,
  loadingDay: _loadingDay,
  currentUser,
  reviewMaxLength,
  onSetHoverStars,
  onSetStars,
  onSetReview,
  onSubmit,
  onSetReviewsSort,
  onSetSocialPostOpen,
  onOpenDeleteReviewModal,
  onSetExpandedReviews,
  onToggleLike,
  onOpenAuthModal,
  onRequireVerifiedEmail,
  onSetReplyingToId,
  onOpenDeleteReplyModal,
  onRequireReplyInteraction,
  onSetReplyTextByRating,
  onSubmitReply,
  onReportReview,
}: HomeReactionsPanelProps) {
  const visibleOtherReviews = (() => {
    const base = sortedOtherReviews.slice(0, 8);

    if (!targetReviewId) return base;
    if (myReview?.id === targetReviewId) return base;
    if (base.some((item) => item.id === targetReviewId)) return base;

    const target = sortedOtherReviews.find((item) => item.id === targetReviewId);

    if (!target) return base;

    return [target, ...base.filter((item) => item.id !== target.id)];
  })();

  function renderReviewRow(
    item: ReviewItem,
    options: {
      mine?: boolean;
      showSectionLabel?: string;
    } = {}
  ) {
    const { mine = false, showSectionLabel } = options;
    const compact = !hasReviewText(item.review);

    return (
      <div key={item.id} className="border-t border-white/8 pt-5 first:border-t-0 first:pt-0">
        {showSectionLabel ? (
          <div className="mb-3 text-sm font-medium text-zinc-200">
            {showSectionLabel}
          </div>
        ) : null}

        <div
          ref={mine ? myReviewBlockRef : undefined}
          id={`review-${item.id}`}
          data-review-id={item.id}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-yellow-400">
              {"★".repeat(clamp(item.stars, 0, 5))}
              <span className="text-zinc-700">
                {"★".repeat(5 - clamp(item.stars, 0, 5))}
              </span>
            </div>

            <span
              className={`rounded-md border px-2 py-0.5 text-xs ${
                mine
                  ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
                  : "border-white/8 bg-white/[0.05] text-zinc-300"
              }`}
            >
              {mine ? "Your review" : item.authorLabel}
            </span>

            <div className="text-xs text-zinc-400">
              {formatReviewDate(item.createdAt)}
            </div>

            {mine ? (
              <ReviewActionsMenu
                disabled={deletingReviewId === item.id}
                onEdit={() => {
                  onSetStars(item.stars);
                  onSetHoverStars(0);
                  onSetReview(item.review);
                  rateBoxRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                onCreatePost={() => {
                  onSetSocialPostOpen(true);
                }}
                onDelete={() => {
                  onOpenDeleteReviewModal(item.id);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => onReportReview(item.id)}
                disabled={reportingReviewId === item.id}
                className="ml-auto text-xs text-amber-300 underline underline-offset-4 transition hover:text-amber-200 disabled:opacity-50"
              >
                {reportingReviewId === item.id ? "Reporting..." : "Report"}
              </button>
            )}
          </div>

          {!compact ? (
            <div>
              <div
                className={`text-sm leading-7 text-zinc-200 break-all [overflow-wrap:anywhere] ${
                  expandedReviews[item.id] ? "" : "line-clamp-3"
                }`}
              >
                {item.review}
              </div>

              {isLongReview(item.review) ? (
                <button
                  type="button"
                  onClick={() =>
                    onSetExpandedReviews((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                  className="mt-2 inline-flex items-center rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {expandedReviews[item.id] ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => onToggleLike(item.id)}
              className="inline-flex items-center gap-2 text-zinc-400 transition hover:text-zinc-200"
            >
              <span
                className={`text-base ${
                  item.likedByMe ? "text-pink-400" : "text-zinc-500"
                }`}
              >
                ♥
              </span>
              <span>{item.likesCount}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!currentUser) {
                  onOpenAuthModal("login");
                  return;
                }

                if (onRequireVerifiedEmail()) return;

                onSetReplyingToId((prev) =>
                  prev === item.id ? null : item.id
                );
              }}
              className="text-zinc-400 underline underline-offset-4 transition hover:text-zinc-200"
            >
              Reply
            </button>
          </div>

          <ReplyList
            replies={item.replies}
            deletingReplyId={deletingReplyId}
            onDeleteReply={onOpenDeleteReplyModal}
            onRequireInteraction={onRequireReplyInteraction}
          />

          {replyingToId === item.id ? (
            <ReplyComposer
              value={replyTextByRating[item.id] ?? ""}
              onChange={(value) =>
                onSetReplyTextByRating((prev) => ({
                  ...prev,
                  [item.id]: value,
                }))
              }
              onSubmit={() => onSubmitReply(item.id)}
              onCancel={() => onSetReplyingToId(null)}
              sending={sendingReplyId === item.id}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={rateBoxRef}
        className="relative z-20 mt-6 scroll-mt-24 overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_28%)]" />

          <div className="relative p-5 sm:p-6">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Your reaction
              </div>

              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <h3 className="text-xl font-semibold text-white">
                    Rate this day
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Share your take on this moment in history.
                  </p>
                </div>

                {myReview ? (
                  <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-4 py-2 text-right backdrop-blur-xl">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300/90">
                      Your current rating
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      ★ {myReview.stars}.0
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-2xl">
              {myReview ? (
                <div className="mb-5 rounded-2xl border border-emerald-400/18 bg-emerald-500/8 px-4 py-3 backdrop-blur-xl">
                  <div className="text-sm font-medium text-emerald-300">
                    You already rated this day.
                  </div>
                  <div className="mt-1 text-xs text-emerald-200/80">
                    You can update your review below whenever you want.
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const v = i + 1;
                      return (
                        <Star
                          key={v}
                          filled={v <= shownStars}
                          title={`${v} star${v > 1 ? "s" : ""}`}
                          onMouseEnter={() => onSetHoverStars(v)}
                          onMouseLeave={() => onSetHoverStars(0)}
                          onClick={() => onSetStars(v)}
                        />
                      );
                    })}
                  </div>

                  <div className="min-w-[56px] text-2xl font-semibold tracking-tight text-white">
                    {shownStars ? `${shownStars}/5` : "—/5"}
                  </div>
                </div>

                <div className="text-sm text-zinc-400 md:text-right">
                  {shownStars
                    ? "Choose how this day feels to you"
                    : "Select a rating from 1 to 5 stars"}
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 text-sm font-medium text-zinc-200">
                  Review
                </div>
                <textarea
                  value={review}
                  onChange={(e) =>
                    onSetReview(e.target.value.slice(0, reviewMaxLength))
                  }
                  maxLength={reviewMaxLength}
                  placeholder="Add a short review, reaction, or opinion about this day..."
                  className="h-28 w-full resize-none rounded-[20px] border border-white/8 bg-[#101010]/90 px-4 py-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-white/14 focus:ring-2 focus:ring-white/10"
                />
                <div className="mt-2 flex justify-end">
                  <div
                    className={`text-xs ${
                      review.length >= reviewMaxLength
                        ? "text-red-400"
                        : review.length >= reviewMaxLength - 40
                          ? "text-amber-300"
                          : "text-zinc-500"
                    }`}
                  >
                    {review.length} / {reviewMaxLength}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={onSubmit}
                  disabled={saving}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : myReview
                      ? "Update your review"
                      : "Rate this day"}
                </button>

                {toast ? (
                  <div className="text-sm text-zinc-300">{toast}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-100">
              Community reactions
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              See what people rated this day
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSetReviewsSort("helpful")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                reviewsSort === "helpful"
                  ? "border border-white/8 bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Most helpful
            </button>

            <button
              type="button"
              onClick={() => onSetReviewsSort("newest")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                reviewsSort === "newest"
                  ? "border border-white/8 bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Newest
            </button>
          </div>
        </div>

        <div className="mt-6">
          {myReview ? renderReviewRow(myReview, { mine: true, showSectionLabel: "Your rating" }) : null}

          <div className={`${myReview ? "mt-8" : ""}`}>
            <div className="mb-3 text-sm font-medium text-zinc-200">
              Latest reviews ({otherReviews.length})
            </div>

            <div className="space-y-0">
              {visibleOtherReviews.map((item) => renderReviewRow(item))}
            </div>

            {otherReviews.length === 0 && !myReview ? (
              <div className="rounded-xl border border-white/8 bg-black/15 p-4 text-sm text-zinc-400">
                No reviews yet. Be the first.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}