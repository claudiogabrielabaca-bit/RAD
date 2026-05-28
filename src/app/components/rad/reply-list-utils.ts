import { ReplyItem } from "@/app/lib/rad-types";

export function formatReviewDate(date?: string) {
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

export function isLongReply(text?: string, limit = 140) {
  return !!text && text.trim().length > limit;
}

export function countDescendantReplies(reply: ReplyItem): number {
  if (!reply.replies?.length) return 0;

  return reply.replies.reduce(
    (total, child) => total + 1 + countDescendantReplies(child),
    0
  );
}

export function countAllReplies(replies: ReplyItem[]): number {
  return replies.reduce(
    (total, reply) => total + 1 + countDescendantReplies(reply),
    0
  );
}

export function containsReplyId(reply: ReplyItem, replyId: string): boolean {
  if (reply.id === replyId) return true;
  return (reply.replies ?? []).some((child) => containsReplyId(child, replyId));
}

export function insertNestedReply(
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

export function updateReplyNode(
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
