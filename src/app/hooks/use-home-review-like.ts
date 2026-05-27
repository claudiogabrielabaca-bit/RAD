import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import type { DayResponse } from "@/app/lib/rad-types";

export function useHomeReviewLike({
  data,
  currentUser,
  openAuthModal,
  requireVerifiedEmail,
  handleProtectedActionStatus,
  setData,
  showToast,
}: {
  data: DayResponse | null;
  currentUser: unknown;
  openAuthModal: (view: "login") => void;
  requireVerifiedEmail: () => boolean;
  handleProtectedActionStatus: (status: number) => boolean;
  setData: Dispatch<SetStateAction<DayResponse | null>>;
  showToast: (message: string) => void;
}) {
  const toggleLike = useCallback(
    async (ratingId: string) => {
      if (!currentUser) {
        openAuthModal("login");
        return;
      }

      if (requireVerifiedEmail()) return;
      if (!data) return;

      const targetReview = data.reviews.find((item) => item.id === ratingId);

      if (!targetReview) return;

      const previousReviews = data.reviews.map((item) => ({
        ...item,
        replies: item.replies,
      }));

      const optimisticLiked = !targetReview.likedByMe;
      const optimisticLikesCount = Math.max(
        0,
        targetReview.likesCount + (optimisticLiked ? 1 : -1)
      );

      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          reviews: prev.reviews.map((item) =>
            item.id === ratingId
              ? {
                  ...item,
                  likedByMe: optimisticLiked,
                  likesCount: optimisticLikesCount,
                }
              : item
          ),
        };
      });

      try {
        const res = await fetch("/api/review-like", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ratingId,
            liked: optimisticLiked,
          }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setData((prev) => {
            if (!prev) return prev;

            return {
              ...prev,
              reviews: previousReviews,
            };
          });

          if (handleProtectedActionStatus(res.status)) {
            return;
          }

          showToast(json?.error ?? "Error giving like.");
          return;
        }

        setData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            reviews: prev.reviews.map((item) =>
              item.id === ratingId
                ? {
                    ...item,
                    likedByMe:
                      typeof json?.liked === "boolean"
                        ? json.liked
                        : optimisticLiked,
                    likesCount:
                      typeof json?.likesCount === "number"
                        ? json.likesCount
                        : optimisticLikesCount,
                  }
                : item
            ),
          };
        });
      } catch {
        setData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            reviews: previousReviews,
          };
        });

        showToast("Error dando like.");
      }
    },
    [
      currentUser,
      data,
      handleProtectedActionStatus,
      openAuthModal,
      requireVerifiedEmail,
      setData,
      showToast,
    ]
  );

  return {
    toggleLike,
  };
}
