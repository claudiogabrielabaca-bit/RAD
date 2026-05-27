import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import type { DayResponse } from "@/app/lib/rad-types";
import { REVIEW_MAX_LENGTH } from "@/app/lib/home-page-client-constants";
import { clamp } from "@/app/lib/home-page-utils";
import { withUpdatedReviews } from "@/app/lib/home-page-review-state";

export function useHomeRatingSubmit({
  day,
  currentUser,
  hoverStars,
  stars,
  review,
  myReviewId,
  openAuthModal,
  requireVerifiedEmail,
  handleProtectedActionStatus,
  invalidateDayCache,
  refreshDayCommunity,
  setToast,
  showToast,
  setData,
}: {
  day: string;
  currentUser: unknown;
  hoverStars: number;
  stars: number;
  review: string;
  myReviewId: string | null;
  openAuthModal: (view: "login") => void;
  requireVerifiedEmail: () => boolean;
  handleProtectedActionStatus: (status: number) => boolean;
  invalidateDayCache: (day: string) => void;
  refreshDayCommunity: (day: string) => Promise<void>;
  setToast: Dispatch<SetStateAction<string>>;
  showToast: (message: string) => void;
  setData: Dispatch<SetStateAction<DayResponse | null>>;
}) {
  const [saving, setSaving] = useState(false);

  const submit = useCallback(async () => {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    const s = clamp(hoverStars || stars, 1, 5);

    if (!s) {
      showToast("Elegí de 1 a 5 estrellas.");
      return;
    }

    if (review.length > REVIEW_MAX_LENGTH) {
      showToast(`Review is too long (max ${REVIEW_MAX_LENGTH} chars).`);
      return;
    }

    const trimmedReview = review.trim();

    setSaving(true);
    setToast("");

    try {
      const res = await fetch(`/api/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day,
          stars: s,
          review: trimmedReview,
        }),
      });

      const json = await res.json().catch(() => null);

      if (handleProtectedActionStatus(res.status)) {
        return;
      }

      if (!res.ok) {
        showToast(json?.error ?? "Error saving review.");
        return;
      }

      invalidateDayCache(day);

      if (myReviewId) {
        setData((prev) => {
          if (!prev) return prev;

          const nextReviews = prev.reviews.map((item) =>
            item.id === myReviewId
              ? {
                  ...item,
                  stars: s,
                  review: trimmedReview,
                }
              : item
          );

          return withUpdatedReviews(prev, nextReviews);
        });
      } else {
        await refreshDayCommunity(day);
      }

      showToast("Review saved.");
    } catch {
      showToast("Error guardando.");
    } finally {
      setSaving(false);
    }
  }, [
    currentUser,
    day,
    handleProtectedActionStatus,
    hoverStars,
    invalidateDayCache,
    myReviewId,
    openAuthModal,
    refreshDayCommunity,
    requireVerifiedEmail,
    review,
    setData,
    setToast,
    showToast,
    stars,
  ]);

  return {
    saving,
    submit,
  };
}
