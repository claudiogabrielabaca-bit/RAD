import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import type { DayResponse } from "@/app/lib/rad-types";
import {
  removeReplyFromTree,
  withUpdatedReviews,
} from "@/app/lib/home-page-review-state";

export function useHomeDeleteMutations({
  day,
  myReviewId,
  handleProtectedActionStatus,
  invalidateDayCache,
  setStars,
  setHoverStars,
  setReview,
  setToast,
  showToast,
  setData,
}: {
  day: string;
  myReviewId: string | null;
  handleProtectedActionStatus: (status: number) => boolean;
  invalidateDayCache: (day: string) => void;
  setStars: Dispatch<SetStateAction<number>>;
  setHoverStars: Dispatch<SetStateAction<number>>;
  setReview: Dispatch<SetStateAction<string>>;
  setToast: Dispatch<SetStateAction<string>>;
  showToast: (message: string) => void;
  setData: Dispatch<SetStateAction<DayResponse | null>>;
}) {
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);

  const deleteReview = useCallback(
    async (ratingId: string) => {
      setDeletingReviewId(ratingId);
      setToast("");

      try {
        const res = await fetch("/api/review-delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ratingId }),
        });

        const json = await res.json().catch(() => null);

        if (handleProtectedActionStatus(res.status)) {
          return;
        }

        if (!res.ok) {
          showToast(json?.error ?? "Could not delete review.");
          return;
        }

        if (myReviewId === ratingId) {
          setStars(0);
          setHoverStars(0);
          setReview("");
        }

        invalidateDayCache(day);

        setData((prev) => {
          if (!prev) return prev;

          const nextReviews = prev.reviews.filter((item) => item.id !== ratingId);
          return withUpdatedReviews(prev, nextReviews);
        });

        showToast("Review deleted.");
      } catch {
        showToast("Could not delete review.");
      } finally {
        setDeletingReviewId(null);
      }
    },
    [
      day,
      handleProtectedActionStatus,
      invalidateDayCache,
      myReviewId,
      setData,
      setHoverStars,
      setReview,
      setStars,
      setToast,
      showToast,
    ]
  );

  const deleteReply = useCallback(
    async (replyId?: string | null) => {
      if (!replyId || typeof replyId !== "string") {
        showToast("Invalid replyId.");
        return;
      }

      setDeletingReplyId(replyId);
      setToast("");

      try {
        const res = await fetch("/api/reply-delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ replyId }),
        });

        const json = await res.json().catch(() => null);

        if (handleProtectedActionStatus(res.status)) {
          return;
        }

        if (!res.ok) {
          showToast(json?.error ?? "Could not delete reply.");
          return;
        }

        invalidateDayCache(day);

        setData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            reviews: prev.reviews.map((item) => ({
              ...item,
              replies: removeReplyFromTree(item.replies ?? [], replyId),
            })),
          };
        });

        showToast("Reply deleted.");
      } catch {
        showToast("Could not delete reply.");
      } finally {
        setDeletingReplyId(null);
      }
    },
    [
      day,
      handleProtectedActionStatus,
      invalidateDayCache,
      setData,
      setToast,
      showToast,
    ]
  );

  return {
    deletingReviewId,
    deletingReplyId,
    deleteReview,
    deleteReply,
  };
}
