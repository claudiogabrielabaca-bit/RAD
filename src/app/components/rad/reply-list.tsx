"use client";

import React, { useState } from "react";
import { ReplyItem } from "@/app/lib/rad-types";

function formatReviewDate(date?: string) {
  if (!date) return "";
  return new Date(date).toLocaleString();
}

function isLongReply(text?: string, limit = 140) {
  return !!text && text.trim().length > limit;
}

export default function ReplyList({
  replies,
  deletingReplyId,
  onDeleteReply,
}: {
  replies: ReplyItem[];
  deletingReplyId: string | null;
  onDeleteReply: (replyId: string) => void;
}) {
  const [expandedReplies, setExpandedReplies] = useState<
    Record<string, boolean>
  >({});

  if (!replies?.length) return null;

  return (
    <div className="mt-4 space-y-3 border-l border-white/10 pl-4">
      {replies.map((reply) => (
        <div
          key={reply.id}
          className="rounded-xl border border-white/10 bg-black/20 p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
              {reply.authorLabel}
            </span>

            <div className="text-xs text-zinc-400">
              {formatReviewDate(reply.createdAt)}
            </div>

            {reply.isMine ? (
              <button
                type="button"
                onClick={() => onDeleteReply(reply.id)}
                disabled={deletingReplyId === reply.id}
                className="text-xs text-red-300 underline underline-offset-4 transition hover:text-red-200 disabled:opacity-50"
              >
                {deletingReplyId === reply.id ? "Deleting..." : "Delete"}
              </button>
            ) : null}
          </div>

          <div className="mt-2">
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
        </div>
      ))}
    </div>
  );
}