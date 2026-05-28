"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReplyComposer from "@/app/components/rad/reply-composer";
import ReportReasonModal from "@/app/components/rad/report-reason-modal";
import {
  containsReplyId,
  countAllReplies,
  countDescendantReplies,
  formatReviewDate,
  isLongReply,
} from "@/app/components/rad/reply-list-utils";
import { ReplyItem } from "@/app/lib/rad-types";
import { useReplyReport } from "@/app/hooks/use-reply-report";
import { useReplyListComposer } from "@/app/hooks/use-reply-list-composer";
import { useReplyLike } from "@/app/hooks/use-reply-like";

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
  targetReplyId,
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
  pendingLikeReplyIds,
  onToggleLike,
  onReportReply,
  expandedThreads,
  onToggleThread,
}: {
  reply: ReplyItem;
  targetReplyId: string | null;
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
  pendingLikeReplyIds: Set<string>;
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
  const likePending = pendingLikeReplyIds.has(reply.id);
  const isTargetReply = !!targetReplyId && reply.id === targetReplyId;

  return (
    <div
      id={`reply-${reply.id}`}
      data-reply-id={reply.id}
      className={`border-l pl-4 transition ${isTargetReply ? "rounded-r-2xl border-sky-400/35 bg-sky-500/10 py-2 pr-3 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]" : "border-white/10"}`}
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
          aria-pressed={!!reply.likedByMe}
          aria-busy={likePending}
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
                : `See replies (${descendantCount})`}
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
              targetReplyId={targetReplyId}
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
              pendingLikeReplyIds={pendingLikeReplyIds}
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
  onProtectedActionStatus,
}: {
  replies: ReplyItem[];
  deletingReplyId: string | null;
  onDeleteReply: (replyId: string) => void;
  onRequireInteraction: () => boolean;
  onProtectedActionStatus: (status: number) => boolean;
}) {
  const searchParams = useSearchParams();

  const [localReplies, setLocalReplies] = useState<ReplyItem[]>(replies ?? []);
  const {
    pendingLikeReplyIds,
    feedbackMessage,
    setFeedbackMessage,
    toggleLike,
  } = useReplyLike({
    onRequireInteraction,
    onProtectedActionStatus,
    setLocalReplies,
  });

  const {
    reportReplyModalOpen,
    reportReplyReason,
    setReportReplyReason,
    reportReplySubmitting,
    reportReply,
    closeReplyReport,
    submitReplyReport,
  } = useReplyReport({
    onRequireInteraction,
    onProtectedActionStatus,
    setLocalReplies,
    setFeedbackMessage,
  });
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>(
    {}
  );
  const [topLevelExpanded, setTopLevelExpanded] = useState(false);


  const {
    replyingToReplyId,
    replyDraftByReplyId,
    sendingReplyId,
    requestReply,
    updateReplyDraft,
    cancelReply,
    submitReplyToReply,
  } = useReplyListComposer({
    onRequireInteraction,
    onProtectedActionStatus,
    setLocalReplies,
    setFeedbackMessage,
    setTopLevelExpanded,
    setExpandedThreads,
  });

  const targetReplyId = searchParams.get("replyId");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLocalReplies(replies ?? []);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [replies]);

  useEffect(() => {
    if (!targetReplyId) return;
    if (!localReplies.length) return;

    const targetExists = localReplies.some((reply) =>
      containsReplyId(reply, targetReplyId)
    );

    if (!targetExists) return;

    const timeout = window.setTimeout(() => {
      setTopLevelExpanded(true);

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
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [localReplies, targetReplyId]);

  useEffect(() => {
    if (!targetReplyId) return;
    if (!topLevelExpanded) return;
    if (!localReplies.some((reply) => containsReplyId(reply, targetReplyId))) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const target = document.getElementById(`reply-${targetReplyId}`);

      target?.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [expandedThreads, localReplies, targetReplyId, topLevelExpanded]);

  const totalReplies = useMemo(
    () => countAllReplies(localReplies),
    [localReplies]
  );

  if (!localReplies?.length) return null;

  function toggleThread(replyId: string) {
    setExpandedThreads((prev) => ({
      ...prev,
      [replyId]: !prev[replyId],
    }));
  }

  return (
    <>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setTopLevelExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
        >
          <Chevron expanded={topLevelExpanded} className="h-4 w-4" />
          <span>
            {topLevelExpanded
              ? "Hide replies"
              : `See replies (${totalReplies})`}
          </span>
        </button>

        {topLevelExpanded ? (
          <div className="mt-4 space-y-4">
            {localReplies.map((reply) => (
              <ReplyThreadItem
                key={reply.id}
                reply={reply}
                targetReplyId={targetReplyId}
                depth={0}
                maxReplyDepth={1}
                deletingReplyId={deletingReplyId}
                onDeleteReply={onDeleteReply}
                replyingToReplyId={replyingToReplyId}
                onRequestReply={requestReply}
                replyDraftByReplyId={replyDraftByReplyId}
                onReplyDraftChange={updateReplyDraft}
                onSubmitReplyToReply={submitReplyToReply}
                onCancelReply={cancelReply}
                sendingReplyId={sendingReplyId}
                pendingLikeReplyIds={pendingLikeReplyIds}
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
        ) : null}
      </div>

      <ReportReasonModal
        open={reportReplyModalOpen}
        title="Report reply"
        subtitle="Tell us why you are reporting this reply."
        value={reportReplyReason}
        onChange={setReportReplyReason}
        onClose={closeReplyReport}
        onSubmit={submitReplyReport}
        submitting={reportReplySubmitting}
        error={feedbackMessage}
        submitLabel="Send reply report"
      />
    </>
  );
}
