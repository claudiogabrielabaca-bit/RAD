import { useState, type Dispatch, type SetStateAction } from "react";
import type { ReplyItem } from "@/app/lib/rad-types";
import { insertNestedReply } from "@/app/components/rad/reply-list-utils";

export function useReplyListComposer({
  onRequireInteraction,
  onProtectedActionStatus,
  setLocalReplies,
  setFeedbackMessage,
  setTopLevelExpanded,
  setExpandedThreads,
}: {
  onRequireInteraction: () => boolean;
  onProtectedActionStatus: (status: number) => boolean;
  setLocalReplies: Dispatch<SetStateAction<ReplyItem[]>>;
  setFeedbackMessage: Dispatch<SetStateAction<string>>;
  setTopLevelExpanded: Dispatch<SetStateAction<boolean>>;
  setExpandedThreads: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const [replyingToReplyId, setReplyingToReplyId] = useState<string | null>(null);
  const [replyDraftByReplyId, setReplyDraftByReplyId] = useState<
    Record<string, string>
  >({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);

  function requestReply(targetReply: ReplyItem) {
    if (onRequireInteraction()) return;

    setFeedbackMessage("");
    setReplyingToReplyId((prev) =>
      prev === targetReply.id ? null : targetReply.id
    );
  }

  function updateReplyDraft(replyId: string, value: string) {
    setReplyDraftByReplyId((prev) => ({
      ...prev,
      [replyId]: value,
    }));
  }

  function cancelReply() {
    setReplyingToReplyId(null);
  }

  async function submitReplyToReply(parentReply: ReplyItem) {
    if (onRequireInteraction()) return;

    const text = (replyDraftByReplyId[parentReply.id] ?? "").trim();

    if (!text) {
      setFeedbackMessage("Reply cannot be empty.");
      return;
    }

    if (parentReply.parentReplyId) {
      setFeedbackMessage("Only one nested reply level is allowed.");
      return;
    }

    setSendingReplyId(parentReply.id);
    setFeedbackMessage("");

    try {
      const res = await fetch("/api/review-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingId: parentReply.ratingId,
          parentReplyId: parentReply.id,
          text,
        }),
      });

      const json = await res.json().catch(() => null);

      if (onProtectedActionStatus(res.status)) {
        return;
      }

      if (!res.ok || !json?.reply) {
        setFeedbackMessage(json?.error ?? "Could not send reply.");
        return;
      }

      setLocalReplies((prev) =>
        insertNestedReply(prev, parentReply.id, json.reply as ReplyItem)
      );

      setTopLevelExpanded(true);

      setExpandedThreads((prev) => ({
        ...prev,
        [parentReply.id]: true,
      }));

      setReplyDraftByReplyId((prev) => ({
        ...prev,
        [parentReply.id]: "",
      }));

      setReplyingToReplyId(null);
    } catch {
      setFeedbackMessage("Could not send reply.");
    } finally {
      setSendingReplyId(null);
    }
  }

  return {
    replyingToReplyId,
    replyDraftByReplyId,
    sendingReplyId,
    requestReply,
    updateReplyDraft,
    cancelReply,
    submitReplyToReply,
  };
}
