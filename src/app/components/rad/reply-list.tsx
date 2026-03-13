"use client";

import { ReplyItem } from "@/app/lib/rad-types";

function formatReviewDate(date?: string) {
  if (!date) return "";
  return new Date(date).toLocaleString();
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

          <div className="mt-2 text-sm leading-6 text-zinc-200">
            {reply.text}
          </div>
        </div>
      ))}
    </div>
  );
}