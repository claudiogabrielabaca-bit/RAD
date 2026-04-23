import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REPLY_MAX_LENGTH = 220;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to reply." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (user.emailVerified === false) {
      return NextResponse.json(
        { error: "You must verify your email to reply." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "review-reply",
      key: buildRateLimitKey(req, user.id),
      limit: 12,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many replies. Please try again later."
      );
    }

    const body = await req.json().catch(() => null);

    const ratingId = body?.ratingId;
    const text = body?.text;
    const rawParentReplyId = body?.parentReplyId;

    if (!ratingId || typeof ratingId !== "string") {
      return NextResponse.json(
        { error: "Invalid ratingId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!text || typeof text !== "string" || text.trim().length < 1) {
      return NextResponse.json(
        { error: "Reply cannot be empty" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (text.trim().length > REPLY_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Reply is too long (max ${REPLY_MAX_LENGTH} chars)` },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parentReplyId =
      rawParentReplyId === null || rawParentReplyId === undefined
        ? null
        : typeof rawParentReplyId === "string"
          ? rawParentReplyId
          : "__invalid__";

    if (parentReplyId === "__invalid__") {
      return NextResponse.json(
        { error: "Invalid parentReplyId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rating = await prisma.rating.findUnique({
      where: { id: ratingId },
      select: {
        id: true,
        day: true,
        userId: true,
      },
    });

    if (!rating) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    let parentReplyOwnerId: string | null = null;

    if (parentReplyId) {
      const parentReply = await prisma.ratingReply.findUnique({
        where: { id: parentReplyId },
        select: {
          id: true,
          ratingId: true,
          parentReplyId: true,
          userId: true,
        },
      });

      if (!parentReply) {
        return NextResponse.json(
          { error: "Parent reply not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      if (parentReply.ratingId !== ratingId) {
        return NextResponse.json(
          { error: "Parent reply does not belong to this review" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      if (parentReply.parentReplyId) {
        return NextResponse.json(
          { error: "Only one nested reply level is allowed." },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      parentReplyOwnerId = parentReply.userId ?? null;
    }

    const reply = await prisma.ratingReply.create({
      data: {
        ratingId,
        userId: user.id,
        anonId: null,
        parentReplyId,
        text: text.trim(),
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    const notificationRecipientId = parentReplyOwnerId ?? rating.userId ?? null;

    if (notificationRecipientId && notificationRecipientId !== user.id) {
      await prisma.notification.create({
        data: {
          userId: notificationRecipientId,
          actorUserId: user.id,
          type: "review_replied",
          reviewId: ratingId,
          replyId: reply.id,
          day: rating.day,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        reply: {
          id: reply.id,
          ratingId: reply.ratingId,
          parentReplyId: reply.parentReplyId,
          text: reply.text,
          createdAt: reply.createdAt.toISOString(),
          isMine: true,
          authorLabel: reply.user?.username ? `@${reply.user.username}` : "User",
          likesCount: 0,
          likedByMe: false,
          reportedByMe: false,
          replies: [],
        },
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("review-reply POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}