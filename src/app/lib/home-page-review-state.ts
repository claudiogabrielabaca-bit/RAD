import type { DayResponse } from "@/app/lib/rad-types";

export function recomputeDayStats(reviews: DayResponse["reviews"]) {
  const count = reviews.length;
  const avg =
    count > 0
      ? reviews.reduce((sum, item) => sum + item.stars, 0) / count
      : 0;

  return { avg, count };
}

export function withUpdatedReviews(
  prev: DayResponse,
  reviews: DayResponse["reviews"]
): DayResponse {
  const { avg, count } = recomputeDayStats(reviews);

  return {
    ...prev,
    reviews,
    avg,
    count,
  };
}

export function removeReplyFromTree(
  replies: DayResponse["reviews"][number]["replies"],
  replyId: string
): DayResponse["reviews"][number]["replies"] {
  return replies
    .filter((reply) => reply.id !== replyId)
    .map((reply) => ({
      ...reply,
      replies: removeReplyFromTree(reply.replies ?? [], replyId),
    }));
}
