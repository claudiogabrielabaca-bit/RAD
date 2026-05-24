import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { invalidateNotificationsCache } from "@/app/lib/notifications-cache";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const MAX_REPLY_ID_LENGTH = 80;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to delete a reply." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => null);
    const replyId =
      typeof body?.replyId === "string" ? body.replyId.trim() : "";

    if (!replyId || replyId.length > MAX_REPLY_ID_LENGTH) {
      return NextResponse.json(
        { error: "Invalid replyId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "reply-delete",
      key: buildRateLimitKey(req, user.id),
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many delete requests. Please try again later."
      );
    }

    const reply = await prisma.ratingReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        userId: true,
        ratingId: true,
      },
    });

    if (!reply) {
      return NextResponse.json(
        { error: "Reply not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (reply.userId !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own reply." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const notificationRecipientIds = Array.from(
      new Set(
        (
          await prisma.notification.findMany({
            where: {
              OR: [
                { replyId },
                { reviewId: reply.ratingId },
              ],
            },
            select: {
              userId: true,
            },
          })
        ).map((item) => item.userId)
      )
    );

    await prisma.ratingReply.delete({
      where: { id: replyId },
    });

    for (const userId of notificationRecipientIds) {
      invalidateNotificationsCache(userId);
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("reply-delete POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
