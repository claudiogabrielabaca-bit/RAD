"use client";

import React, { useEffect, useState } from "react";
import ReplyComposer from "@/app/components/rad/reply-composer";
import { ReplyItem } from "@/app/lib/rad-types";

function formatReviewDate(date?: string) {
  if (!date) return "";
  return new Date(date).toLocaleString();
}

function isLongReply(text?: string, limit = 140) {
  return !!text && text.trim().length > limit;
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
}) {
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>(
    {}
  );

  const canReply = depth < maxReplyDepth;
  const showDelete = !!reply.isMine;
  const showReport = !reply.isMine;

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 backdrop-blur-xl">
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

      <div className="mt-3">
        <div
          className={`text-sm leading-6 text-zinc-200 break-all [overflow-wrap:anywhere] ${
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

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => onToggleLike(reply)}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          <span
            className={`text-base ${reply.likedByMe ? "text-pink-400" : "text-zinc-500"}`}
          >
            ♥
          </span>
          <span>{reply.likesCount}</span>
        </button>

        {canReply ? (
          <button
            type="button"
            onClick={() => onRequestReply(reply)}
            className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-zinc-200"
          >
            Reply
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

      {reply.replies?.length ? (
        <div className="mt-4 border-l border-white/10 pl-4 space-y-3">
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
  const [localReplies, setLocalReplies] = useState<ReplyItem[]>(replies ?? []);
  const [replyingToReplyId, setReplyingToReplyId] = useState<string | null>(null);
  const [replyDraftByReplyId, setReplyDraftByReplyId] = useState<
    Record<string, string>
  >({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");

  useEffect(() => {
    setLocalReplies(replies ?? []);
  }, [replies]);

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
          likedByMe: !!json?.likedByMe,
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

  async function reportReply(reply: ReplyItem) {
    if (reply.reportedByMe) return;
    if (onRequireInteraction()) return;

    const reason = window.prompt(
      "Why are you reporting this reply?",
      "Spam or abusive content"
    );

    if (!reason || reason.trim().length < 3) {
      setFeedbackMessage("Report reason must be at least 3 characters.");
      return;
    }

    setFeedbackMessage("");

    try {
      const res = await fetch("/api/reply-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          replyId: reply.id,
          reason: reason.trim(),
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
        updateReplyNode(prev, reply.id, (current) => ({
          ...current,
          reportedByMe: true,
        }))
      );

      if (!json?.alreadyReported) {
        setFeedbackMessage("Reply reported.");
      }
    } catch {
      setFeedbackMessage("Could not report reply.");
    }
  }

  return (
    <div className="mt-4 space-y-3">
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
        />
      ))}

      {feedbackMessage ? (
        <div className="text-xs text-amber-300">{feedbackMessage}</div>
      ) : null}
    </div>
  );
}