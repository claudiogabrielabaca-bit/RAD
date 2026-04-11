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
  loadingDay,
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

      <div className="mt-6 rounded-2xl border border-white/8 bg-black/18 p-5 backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-100">
              Community reactions
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              See how people rated this day
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

        {myReview ? (
          <div ref={myReviewBlockRef} className="mt-5">
            <div className="mb-2 text-sm font-medium text-zinc-200">
              Your rating
            </div>

            <div className="rounded-2xl border border-emerald-400/18 bg-emerald-500/5 p-4 backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-yellow-400">
                  {"★".repeat(clamp(myReview.stars, 0, 5))}
                  <span className="text-zinc-700">
                    {"★".repeat(5 - clamp(myReview.stars, 0, 5))}
                  </span>
                </div>

                <span className="rounded-md border border-emerald-400/20 bg-emerald-500/18 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  Your review
                </span>

                <div className="text-xs text-zinc-400">
                  {formatReviewDate(myReview.createdAt)}
                </div>
                <ReviewActionsMenu
                  disabled={deletingReviewId === myReview.id}
                  onEdit={() => {
                    onSetStars(myReview.stars);
                    onSetHoverStars(0);
                    onSetReview(myReview.review);
                    rateBoxRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  onCreatePost={() => {
                    onSetSocialPostOpen(true);
                  }}
                  onDelete={() => {
                    onOpenDeleteReviewModal(myReview.id);
                  }}
                />
              </div>

              {hasReviewText(myReview.review) ? (
                <div className="mt-3">
                  <div
                    className={`text-sm leading-6 text-zinc-200 break-all [overflow-wrap:anywhere] ${
                      expandedReviews[myReview.id] ? "" : "line-clamp-3"
                    }`}
                  >
                    {myReview.review}
                  </div>

                  {isLongReview(myReview.review) ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSetExpandedReviews((prev) => ({
                          ...prev,
                          [myReview.id]: !prev[myReview.id],
                        }))
                      }
                      className="mt-2 inline-flex items-center rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      {expandedReviews[myReview.id]
                        ? "Show less"
                        : "Show more"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div
                className={`${
                  hasReviewText(myReview.review) ? "mt-3" : "mt-2"
                } flex flex-wrap items-center gap-4`}
              >
                <button
                  type="button"
                  onClick={() => onToggleLike(myReview.id)}
                  className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
                >
                  <span
                    className={`text-base ${
                      myReview.likedByMe ? "text-pink-400" : "text-zinc-500"
                    }`}
                  >
                    ♥
                  </span>
                  <span>{myReview.likesCount}</span>
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
                      prev === myReview.id ? null : myReview.id
                    );
                  }}
                  className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-zinc-200"
                >
                  Reply
                </button>
              </div>

              <ReplyList
                replies={myReview.replies}
                deletingReplyId={deletingReplyId}
                onDeleteReply={onOpenDeleteReplyModal}
                onRequireInteraction={onRequireReplyInteraction}
              />

              {replyingToId === myReview.id ? (
                <ReplyComposer
                  value={replyTextByRating[myReview.id] ?? ""}
                  onChange={(value) =>
                    onSetReplyTextByRating((prev) => ({
                      ...prev,
                      [myReview.id]: value,
                    }))
                  }
                  onSubmit={() => onSubmitReply(myReview.id)}
                  onCancel={() => onSetReplyingToId(null)}
                  sending={sendingReplyId === myReview.id}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <div className="mb-2 text-sm font-medium text-zinc-200">
            Latest reviews ({otherReviews.length})
          </div>

          {loadingDay ? (
            <div className="mb-3 text-xs text-zinc-400">Loading…</div>
          ) : null}

          <div className="space-y-3">
            {sortedOtherReviews.slice(0, 8).map((r) => {
              const compact = !hasReviewText(r.review);

              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-white/8 bg-black/20 p-4 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-yellow-400">
                      {"★".repeat(clamp(r.stars, 0, 5))}
                      <span className="text-zinc-700">
                        {"★".repeat(5 - clamp(r.stars, 0, 5))}
                      </span>
                    </div>

                    <span className="rounded-md border border-white/8 bg-white/[0.05] px-2 py-0.5 text-xs text-zinc-300">
                      {r.authorLabel}
                    </span>

                    <div className="text-xs text-zinc-400">
                      {formatReviewDate(r.createdAt)}
                    </div>

                    <button
                      type="button"
                      onClick={() => onReportReview(r.id)}
                      disabled={reportingReviewId === r.id}
                      className="ml-auto text-xs text-amber-300 underline underline-offset-4 transition hover:text-amber-200 disabled:opacity-50"
                    >
                      {reportingReviewId === r.id ? "Reporting..." : "Report"}
                    </button>
                  </div>

                  {!compact ? (
                    <div className="mt-3">
                      <div
                        className={`text-sm leading-6 text-zinc-200 break-all [overflow-wrap:anywhere] ${
                          expandedReviews[r.id] ? "" : "line-clamp-3"
                        }`}
                      >
                        {r.review}
                      </div>

                      {isLongReview(r.review) ? (
                        <button
                          type="button"
                          onClick={() =>
                            onSetExpandedReviews((prev) => ({
                              ...prev,
                              [r.id]: !prev[r.id],
                            }))
                          }
                          className="mt-2 inline-flex items-center rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          {expandedReviews[r.id] ? "Show less" : "Show more"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    className={`${
                      compact ? "mt-2" : "mt-3"
                    } flex flex-wrap items-center gap-4`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleLike(r.id)}
                      className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
                    >
                      <span
                        className={`text-base ${
                          r.likedByMe ? "text-pink-400" : "text-zinc-500"
                        }`}
                      >
                        ♥
                      </span>
                      <span>{r.likesCount}</span>
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
                          prev === r.id ? null : r.id
                        );
                      }}
                      className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-zinc-200"
                    >
                      Reply
                    </button>
                  </div>

                  <ReplyList
                    replies={r.replies}
                    deletingReplyId={deletingReplyId}
                    onDeleteReply={onOpenDeleteReplyModal}
                    onRequireInteraction={onRequireReplyInteraction}
                  />

                  {replyingToId === r.id ? (
                    <ReplyComposer
                      value={replyTextByRating[r.id] ?? ""}
                      onChange={(value) =>
                        onSetReplyTextByRating((prev) => ({
                          ...prev,
                          [r.id]: value,
                        }))
                      }
                      onSubmit={() => onSubmitReply(r.id)}
                      onCancel={() => onSetReplyingToId(null)}
                      sending={sendingReplyId === r.id}
                    />
                  ) : null}
                </div>
              );
            })}

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