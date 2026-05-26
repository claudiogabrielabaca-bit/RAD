import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import type { DayResponse } from "@/app/lib/rad-types";
import { REPLY_MAX_LENGTH } from "@/app/lib/home-page-client-constants";

export function useHomeReplyComposer({
  day,
  currentUser,
  openAuthModal,
  requireVerifiedEmail,
  handleProtectedActionStatus,
  setToast,
  showToast,
  setData,
  invalidateDayCache,
}: {
  day: string;
  currentUser: unknown;
  openAuthModal: (view: "login") => void;
  requireVerifiedEmail: () => boolean;
  handleProtectedActionStatus: (status: number) => boolean;
  setToast: Dispatch<SetStateAction<string>>;
  showToast: (message: string) => void;
  setData: Dispatch<SetStateAction<DayResponse | null>>;
  invalidateDayCache: (day: string) => void;
}) {
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyTextByRating, setReplyTextByRating] = useState<
    Record<string, string>
  >({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);

  const submitReply = useCallback(
    async (ratingId: string) => {
      if (!currentUser) {
        openAuthModal("login");
        return;
      }

      if (requireVerifiedEmail()) return;

      const text = (replyTextByRating[ratingId] ?? "").trim();

      if (!text) {
        showToast("Reply cannot be empty.");
        return;
      }

      if (text.length > REPLY_MAX_LENGTH) {
        showToast(`Reply is too long (max ${REPLY_MAX_LENGTH} chars).`);
        return;
      }

      setSendingReplyId(ratingId);
      setToast("");

      try {
        const res = await fetch("/api/review-reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ratingId,
            text,
          }),
        });

        const json = await res.json().catch(() => null);

        if (handleProtectedActionStatus(res.status)) {
          return;
        }

        if (!res.ok) {
          showToast(json?.error ?? "Could not send reply.");
          return;
        }

        setReplyTextByRating((prev) => ({
          ...prev,
          [ratingId]: "",
        }));
        setReplyingToId(null);

        invalidateDayCache(day);

        if (json?.reply) {
          setData((prev) => {
            if (!prev) return prev;

            return {
              ...prev,
              reviews: prev.reviews.map((item) =>
                item.id === ratingId
                  ? {
                      ...item,
                      replies: [...(item.replies ?? []), json.reply],
                    }
                  : item
              ),
            };
          });
        }

        showToast("Reply sent.");
      } catch {
        showToast("Could not send reply.");
      } finally {
        setSendingReplyId(null);
      }
    },
    [
      currentUser,
      day,
      handleProtectedActionStatus,
      invalidateDayCache,
      openAuthModal,
      replyTextByRating,
      requireVerifiedEmail,
      setData,
      setToast,
      showToast,
    ]
  );

  return {
    replyingToId,
    replyTextByRating,
    sendingReplyId,
    setReplyingToId,
    setReplyTextByRating,
    submitReply,
  };
}
