import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { updateReplyNode } from "@/app/components/rad/reply-list-utils";
import { ReplyItem } from "@/app/lib/rad-types";

export function useReplyLike({
  onRequireInteraction,
  onProtectedActionStatus,
  setLocalReplies,
}: {
  onRequireInteraction: () => boolean;
  onProtectedActionStatus: (status: number) => boolean;
  setLocalReplies: Dispatch<SetStateAction<ReplyItem[]>>;
}) {
  const [pendingLikeReplyIds, setPendingLikeReplyIds] = useState<Set<string>>(
    () => new Set()
  );
  const replyLikeRequestSeqRef = useRef(0);
  const replyLikeLatestSeqByIdRef = useRef<Map<string, number>>(new Map());
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");

  async function toggleLike(reply: ReplyItem) {
    if (onRequireInteraction()) return;

    const previousLiked = !!reply.likedByMe;
    const previousCount = reply.likesCount;
    const nextLiked = !previousLiked;
    const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));
    const requestSeq = replyLikeRequestSeqRef.current + 1;

    replyLikeRequestSeqRef.current = requestSeq;
    replyLikeLatestSeqByIdRef.current.set(reply.id, requestSeq);

    const isLatestRequest = () =>
      replyLikeLatestSeqByIdRef.current.get(reply.id) === requestSeq;

    const rollback = () => {
      if (!isLatestRequest()) return;

      setLocalReplies((prev) =>
        updateReplyNode(prev, reply.id, (current) => ({
          ...current,
          likedByMe: previousLiked,
          likesCount: previousCount,
        }))
      );
    };

    setFeedbackMessage("");
    setPendingLikeReplyIds((prev) => {
      const next = new Set(prev);
      next.add(reply.id);
      return next;
    });

    setLocalReplies((prev) =>
      updateReplyNode(prev, reply.id, (current) => ({
        ...current,
        likedByMe: nextLiked,
        likesCount: nextCount,
      }))
    );

    try {
      const res = await fetch("/api/reply-like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          replyId: reply.id,
          liked: nextLiked,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!isLatestRequest()) {
        return;
      }

      if (onProtectedActionStatus(res.status)) {
        rollback();
        return;
      }

      if (!res.ok) {
        rollback();
        setFeedbackMessage(json?.error ?? "Could not like reply.");
        return;
      }

      setLocalReplies((prev) =>
        updateReplyNode(prev, reply.id, (current) => ({
          ...current,
          likedByMe:
            typeof json?.liked === "boolean" ? json.liked : nextLiked,
          likesCount:
            typeof json?.likesCount === "number" ? json.likesCount : nextCount,
        }))
      );
    } catch {
      rollback();

      if (isLatestRequest()) {
        setFeedbackMessage("Could not like reply.");
      }
    } finally {
      if (isLatestRequest()) {
        replyLikeLatestSeqByIdRef.current.delete(reply.id);

        setPendingLikeReplyIds((prev) => {
          const next = new Set(prev);
          next.delete(reply.id);
          return next;
        });
      }
    }
  }

  return {
    pendingLikeReplyIds,
    feedbackMessage,
    setFeedbackMessage,
    toggleLike,
  };
}
