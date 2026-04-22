"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReplyComposer from "@/app/components/rad/reply-composer";
import ReportReasonModal from "@/app/components/rad/report-reason-modal";
import { ReplyItem } from "@/app/lib/rad-types";

function formatReviewDate(date?: string) {
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(date));
  } catch {
    return date;
  }
}

function isLongReply(text?: string, limit = 140) {
  return !!text && text.trim().length > limit;
}

function countDescendantReplies(reply: ReplyItem): number {
  if (!reply.replies?.length) return 0;

  return reply.replies.reduce(
    (total, child) => total + 1 + countDescendantReplies(child),
    0
  );
}

function containsReplyId(reply: ReplyItem, replyId: string): boolean {
  if (reply.id === replyId) return true;
  return (reply.replies ?? []).some((child) => containsReplyId(child, replyId));
}

function insertNestedReply(
  replies: ReplyItem[],
  parentReplyId: string,
  nextReply: ReplyItem
): ReplyItem[] {
  return replies.map((reply) => {
    if (reply.id === parentReplyId) {
      return {
        ...reply,
        replies: [...(reply.replies ?? []), nextReply],
      };
    }

    if (!reply.replies?.length) {
      return reply;
    }

    return {
      ...reply,
      replies: insertNestedReply(reply.replies, parentReplyId, nextReply),
    };
  });
}

function updateReplyNode(
  replies: ReplyItem[],
  targetReplyId: string,
  updater: (reply: ReplyItem) => ReplyItem
): ReplyItem[] {
  return replies.map((reply) => {
    if (reply.id === targetReplyId) {
      return updater(reply);
    }

    if (!reply.replies?.length) {
      return reply;
    }

    return {
      ...reply,
      replies: updateReplyNode(reply.replies, targetReplyId, updater),
    };
  });
}

function Chevron({
  expanded,
  className = "",
}: {
  expanded: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {expanded ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

function ReplyThreadItem({
  reply,
  depth,
  maxReplyDepth,
  deletingReplyId,
  onDeleteReply,
  replyingToReplyId,
  onRequestReply,
  replyDraftByReplyId,
  onReplyDraftChange,
  onSubmitReplyToReply,
  onCancelReply,
  sendingReplyId,
  onToggleLike,
  onReportReply,
  expandedThreads,
  onToggleThread,
}: {
  reply: ReplyItem;
  depth: number;
  maxReplyDepth: number;
  deletingReplyId: string | null;
  onDeleteReply: (replyId: string) => void;
  replyingToReplyId: string | null;
  onRequestReply: (reply: ReplyItem) => void;
  replyDraftByReplyId: Record<string, string>;
  onReplyDraftChange: (replyId: string, value: string) => void;
  onSubmitReplyToReply: (reply: ReplyItem) => void;
  onCancelReply: () => void;
  sendingReplyId: string | null;
  onToggleLike: (reply: ReplyItem) => void;
  onReportReply: (reply: ReplyItem) => void;
  expandedThreads: Record<string, boolean>;
  onToggleThread: (replyId: string) => void;
}) {
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>(
    {}
  );

  const canReply = depth < maxReplyDepth;
  const showDelete = !!reply.isMine;
  const showReport = !reply.isMine;
  const descendantCount = countDescendantReplies(reply);
  const threadExpanded = !!expandedThreads[reply.id];

  return (
    <div
      id={`reply-${reply.id}`}
      data-reply-id={reply.id}
      className="border-l border-white/10 pl-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-white/8 bg-white/[0.05] px-2 py-0.5 text-xs text-zinc-300">
          {reply.authorLabel}
        </span>

        <div className="text-xs text-zinc-400">
          {formatReviewDate(reply.createdAt)}
        </div>

        {showReport ? (
          <button
            type="button"
            onClick={() => onReportReply(reply)}
            disabled={!!reply.reportedByMe}
            className="ml-auto text-xs text-amber-300 underline underline-offset-4 transition hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reply.reportedByMe ? "Reported" : "Report"}
          </button>
        ) : null}

        {showDelete ? (
          <button
            type="button"
            onClick={() => onDeleteReply(reply.id)}
            disabled={deletingReplyId === reply.id}
            className={`${showReport ? "" : "ml-auto"} text-xs text-red-300 underline underline-offset-4 transition hover:text-red-200 disabled:opacity-50`}
          >
            {deletingReplyId === reply.id ? "Deleting..." : "Delete"}
          </button>
        ) : null}
      </div>

      <div className="mt-2">
        <div
          className={`text-sm leading-7 text-zinc-200 break-all [overflow-wrap:anywhere] ${
            expandedReplies[reply.id] ? "" : "line-clamp-3"
          }`}
        >
          {reply.text}
        </div>

        {isLongReply(reply.text) ? (
          <button
            type="button"
            onClick={() =>
              setExpandedReplies((prev) => ({
                ...prev,
                [reply.id]: !prev[reply.id],
              }))
            }
            className="mt-2 inline-flex items-center rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            {expandedReplies[reply.id] ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <button
          type="button"
          onClick={() => onToggleLike(reply)}
          className="inline-flex items-center gap-2 text-zinc-400 transition hover:text-zinc-200"
        >
          <span
            className={`text-base ${
              reply.likedByMe ? "text-pink-400" : "text-zinc-500"
            }`}
          >
            ♥
          </span>
          <span>{reply.likesCount}</span>
        </button>

        {canReply ? (
          <button
            type="button"
            onClick={() => onRequestReply(reply)}
            className="text-zinc-400 underline underline-offset-4 transition hover:text-zinc-200"
          >
            Reply
          </button>
        ) : null}

        {descendantCount > 0 ? (
          <button
            type="button"
            onClick={() => onToggleThread(reply.id)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
          >
            <Chevron expanded={threadExpanded} className="h-4 w-4" />
            <span>
              {threadExpanded
                ? "Hide replies"
                : `View ${descendantCount} ${descendantCount === 1 ? "reply" : "replies"}`}
            </span>
          </button>
        ) : null}
      </div>

      {replyingToReplyId === reply.id ? (
        <div className="mt-4">
          <ReplyComposer
            value={replyDraftByReplyId[reply.id] ?? ""}
            onChange={(value) => onReplyDraftChange(reply.id, value)}
            onSubmit={() => onSubmitReplyToReply(reply)}
            onCancel={onCancelReply}
            sending={sendingReplyId === reply.id}
          />
        </div>
      ) : null}

      {reply.replies?.length && threadExpanded ? (
        <div className="mt-4 space-y-4 pl-4">
          {reply.replies.map((childReply) => (
            <ReplyThreadItem
              key={childReply.id}
              reply={childReply}
              depth={depth + 1}
              maxReplyDepth={maxReplyDepth}
              deletingReplyId={deletingReplyId}
              onDeleteReply={onDeleteReply}
              replyingToReplyId={replyingToReplyId}
              onRequestReply={onRequestReply}
              replyDraftByReplyId={replyDraftByReplyId}
              onReplyDraftChange={onReplyDraftChange}
              onSubmitReplyToReply={onSubmitReplyToReply}
              onCancelReply={onCancelReply}
              sendingReplyId={sendingReplyId}
              onToggleLike={onToggleLike}
              onReportReply={onReportReply}
              expandedThreads={expandedThreads}
              onToggleThread={onToggleThread}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ReplyList({
  replies,
  deletingReplyId,
  onDeleteReply,
  onRequireInteraction,
}: {
  replies: ReplyItem[];
  deletingReplyId: string | null;
  onDeleteReply: (replyId: string) => void;
  onRequireInteraction: () => boolean;
}) {
  const searchParams = useSearchParams();

  const [localReplies, setLocalReplies] = useState<ReplyItem[]>(replies ?? []);
  const [replyingToReplyId, setReplyingToReplyId] = useState<string | null>(null);
  const [replyDraftByReplyId, setReplyDraftByReplyId] = useState<
    Record<string, string>
  >({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");

  const [reportReplyModalOpen, setReportReplyModalOpen] = useState(false);
  const [reportReplyTargetId, setReportReplyTargetId] = useState<string | null>(
    null
  );
  const [reportReplyReason, setReportReplyReason] = useState(
    "Spam or abusive content"
  );
  const [reportReplySubmitting, setReportReplySubmitting] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>(
    {}
  );

  const targetReplyId = searchParams.get("replyId");

  useEffect(() => {
    setLocalReplies(replies ?? []);
  }, [replies]);

  useEffect(() => {
    if (!targetReplyId) return;
    if (!localReplies.length) return;

    setExpandedThreads((prev) => {
      const next = { ...prev };
      let changed = false;

      const visit = (reply: ReplyItem) => {
        if (reply.replies?.length && containsReplyId(reply, targetReplyId)) {
          if (!next[reply.id]) {
            next[reply.id] = true;
            changed = true;
          }
        }

        (reply.replies ?? []).forEach(visit);
      };

      localReplies.forEach(visit);

      return changed ? next : prev;
    });
  }, [localReplies, targetReplyId]);

  const totalReplies = useMemo(
    () => localReplies.reduce((total, reply) => total + 1 + countDescendantReplies(reply), 0),
    [localReplies]
  );

  if (!localReplies?.length) return null;

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

      if (res.status === 401 || res.status === 403) {
        onRequireInteraction();
        return;
      }

      if (!res.ok || !json?.reply) {
        setFeedbackMessage(json?.error ?? "Could not send reply.");
        return;
      }

      setLocalReplies((prev) =>
        insertNestedReply(prev, parentReply.id, json.reply as ReplyItem)
      );
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

  async function toggleLike(reply: ReplyItem) {
    if (onRequireInteraction()) return;

    setFeedbackMessage("");

    try {
      const res = await fetch("/api/reply-like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          replyId: reply.id,
        }),
      });

      const json = await res.json().catch(() => null);

      if (res.status === 401 || res.status === 403) {
        onRequireInteraction();
        return;
      }

      if (!res.ok) {
        setFeedbackMessage(json?.error ?? "Could not like reply.");
        return;
      }

      setLocalReplies((prev) =>
        updateReplyNode(prev, reply.id, (current) => ({
          ...current,
          likedByMe:
            typeof json?.liked === "boolean"
              ? json.liked
              : current.likedByMe,
          likesCount:
            typeof json?.likesCount === "number"
              ? json.likesCount
              : current.likesCount,
        }))
      );
    } catch {
      setFeedbackMessage("Could not like reply.");
    }
  }

  function reportReply(reply: ReplyItem) {
    if (reply.reportedByMe) return;
    if (onRequireInteraction()) return;

    setReportReplyTargetId(reply.id);
    setReportReplyReason("Spam or abusive content");
    setFeedbackMessage("");
    setReportReplyModalOpen(true);
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

      if (res.status === 401 || res.status === 403) {
        onRequireInteraction();
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

  function toggleThread(replyId: string) {
    setExpandedThreads((prev) => ({
      ...prev,
      [replyId]: !prev[replyId],
    }));
  }

  return (
    <>
      <div className="mt-4 space-y-4">
        {totalReplies > 0 ? (
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Replies
          </div>
        ) : null}

        {localReplies.map((reply) => (
          <ReplyThreadItem
            key={reply.id}
            reply={reply}
            depth={0}
            maxReplyDepth={1}
            deletingReplyId={deletingReplyId}
            onDeleteReply={onDeleteReply}
            replyingToReplyId={replyingToReplyId}
            onRequestReply={(targetReply) => {
              if (onRequireInteraction()) return;

              setFeedbackMessage("");
              setReplyingToReplyId((prev) =>
                prev === targetReply.id ? null : targetReply.id
              );
            }}
            replyDraftByReplyId={replyDraftByReplyId}
            onReplyDraftChange={(replyId, value) =>
              setReplyDraftByReplyId((prev) => ({
                ...prev,
                [replyId]: value,
              }))
            }
            onSubmitReplyToReply={submitReplyToReply}
            onCancelReply={() => setReplyingToReplyId(null)}
            sendingReplyId={sendingReplyId}
            onToggleLike={toggleLike}
            onReportReply={reportReply}
            expandedThreads={expandedThreads}
            onToggleThread={toggleThread}
          />
        ))}

        {feedbackMessage ? (
          <div className="text-xs text-amber-300">{feedbackMessage}</div>
        ) : null}
      </div>

      <ReportReasonModal
        open={reportReplyModalOpen}
        title="Report reply"
        subtitle="Tell us why you are reporting this reply."
        value={reportReplyReason}
        onChange={setReportReplyReason}
        onClose={() => {
          if (reportReplySubmitting) return;
          setReportReplyModalOpen(false);
          setReportReplyTargetId(null);
        }}
        onSubmit={submitReplyReport}
        submitting={reportReplySubmitting}
        error={feedbackMessage}
        submitLabel="Send reply report"
      />
    </>
  );
}