import { useState } from "react";

export type PendingDeleteAction =
  | {
      kind: "review";
      id: string;
    }
  | {
      kind: "reply";
      id: string;
    }
  | null;

export function useHomeDeleteActions(params: {
  deletingReviewId: string | null;
  deletingReplyId: string | null;
  showToast: (message: string, duration?: number) => void;
  deleteReview: (ratingId: string) => Promise<void>;
  deleteReply: (replyId: string) => Promise<void>;
}) {
  const {
    deletingReviewId,
    deletingReplyId,
    showToast,
    deleteReview,
    deleteReply,
  } = params;

  const [pendingDeleteAction, setPendingDeleteAction] =
    useState<PendingDeleteAction>(null);

  function openDeleteReviewModal(ratingId: string) {
    setPendingDeleteAction({
      kind: "review",
      id: ratingId,
    });
  }

  function openDeleteReplyModal(replyId?: string | null) {
    if (!replyId || typeof replyId !== "string") {
      showToast("Invalid replyId.");
      return;
    }

    setPendingDeleteAction({
      kind: "reply",
      id: replyId,
    });
  }

  function closeDeleteModal() {
    if (deletingReviewId || deletingReplyId) return;
    setPendingDeleteAction(null);
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteAction) return;

    const currentAction = pendingDeleteAction;
    setPendingDeleteAction(null);

    if (currentAction.kind === "review") {
      await deleteReview(currentAction.id);
      return;
    }

    await deleteReply(currentAction.id);
  }

  return {
    pendingDeleteAction,
    openDeleteReviewModal,
    openDeleteReplyModal,
    closeDeleteModal,
    handleConfirmDelete,
  };
}