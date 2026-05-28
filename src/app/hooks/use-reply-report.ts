import { useState } from "react";
import { ReplyItem } from "@/app/lib/rad-types";
import { updateReplyNode } from "@/app/components/rad/reply-list-utils";

export function useReplyReport({
  onRequireInteraction,
  onProtectedActionStatus,
  setLocalReplies,
  setFeedbackMessage,
}: {
  onRequireInteraction: () => boolean;
  onProtectedActionStatus: (status: number) => boolean;
  setLocalReplies: React.Dispatch<React.SetStateAction<ReplyItem[]>>;
  setFeedbackMessage: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [reportReplyModalOpen, setReportReplyModalOpen] = useState(false);
  const [reportReplyTargetId, setReportReplyTargetId] = useState<string | null>(
    null
  );
  const [reportReplyReason, setReportReplyReason] = useState(
    "Spam or abusive content"
  );
  const [reportReplySubmitting, setReportReplySubmitting] = useState(false);

  function reportReply(reply: ReplyItem) {
    if (reply.reportedByMe) return;
    if (onRequireInteraction()) return;

    setReportReplyTargetId(reply.id);
    setReportReplyReason("Spam or abusive content");
    setFeedbackMessage("");
    setReportReplyModalOpen(true);
  }

  function closeReplyReport() {
    if (reportReplySubmitting) return;

    setReportReplyModalOpen(false);
    setReportReplyTargetId(null);
  }

  async function submitReplyReport() {
    if (!reportReplyTargetId) return;

    const reason = reportReplyReason.trim();

    if (reason.length < 3) {
      setFeedbackMessage("Report reason must be at least 3 characters.");
      return;
    }

    setReportReplySubmitting(true);
    setFeedbackMessage("");

    try {
      const res = await fetch("/api/reply-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          replyId: reportReplyTargetId,
          reason,
        }),
      });

      const json = await res.json().catch(() => null);

      if (onProtectedActionStatus(res.status)) {
        return;
      }

      if (!res.ok) {
        setFeedbackMessage(json?.error ?? "Could not report reply.");
        return;
      }

      setLocalReplies((prev) =>
        updateReplyNode(prev, reportReplyTargetId, (current) => ({
          ...current,
          reportedByMe: true,
        }))
      );

      setReportReplyModalOpen(false);
      setReportReplyTargetId(null);
      setReportReplyReason("Spam or abusive content");

      if (!json?.alreadyReported) {
        setFeedbackMessage("Reply reported.");
      }
    } catch {
      setFeedbackMessage("Could not report reply.");
    } finally {
      setReportReplySubmitting(false);
    }
  }

  return {
    reportReplyModalOpen,
    reportReplyReason,
    setReportReplyReason,
    reportReplySubmitting,
    reportReply,
    closeReplyReport,
    submitReplyReport,
  };
}
