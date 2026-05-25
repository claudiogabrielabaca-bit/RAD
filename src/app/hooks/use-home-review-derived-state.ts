import { useEffect, useMemo } from "react";
import type { DayResponse } from "@/app/lib/rad-types";
import { hasReviewText } from "@/app/lib/home-page-utils";

export type HomeReviewsSort = "helpful" | "newest";

export function useHomeReviewDerivedState({
  data,
  reviewsSort,
  setStars,
  setHoverStars,
  setReview,
}: {
  data: DayResponse | null;
  reviewsSort: HomeReviewsSort;
  setStars: (value: number) => void;
  setHoverStars: (value: number) => void;
  setReview: (value: string) => void;
}) {
  const allReviews = useMemo(() => data?.reviews ?? [], [data?.reviews]);

  const myReview = useMemo(() => allReviews.find((r) => r.isMine), [allReviews]);

  useEffect(() => {
    if (!myReview) {
      setStars(0);
      setHoverStars(0);
      setReview("");
      return;
    }

    setStars(myReview.stars);
    setHoverStars(0);
    setReview(myReview.review);
  }, [myReview, setHoverStars, setReview, setStars]);

  const otherReviews = useMemo(
    () => allReviews.filter((r) => !r.isMine),
    [allReviews]
  );

  const sortedOtherReviews = useMemo(() => {
    return [...otherReviews].sort((a, b) => {
      if (reviewsSort === "helpful") {
        if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;

        const aHasText = hasReviewText(a.review) ? 1 : 0;
        const bHasText = hasReviewText(b.review) ? 1 : 0;
        if (bHasText !== aHasText) return bHasText - aHasText;

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [otherReviews, reviewsSort]);

  return {
    allReviews,
    myReview,
    otherReviews,
    sortedOtherReviews,
  };
}
