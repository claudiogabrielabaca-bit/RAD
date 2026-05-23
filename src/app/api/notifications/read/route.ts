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

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const NOTIFICATIONS_READ_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const NOTIFICATIONS_READ_RATE_LIMIT_LIMIT = 120;
const MAX_NOTIFICATION_ID_LENGTH = 80;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to update notifications." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "notifications-read",
      key: buildRateLimitKey(req, user.id),
      limit: NOTIFICATIONS_READ_RATE_LIMIT_LIMIT,
      windowMs: NOTIFICATIONS_READ_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many notification updates. Please try again later."
      );
    }

    const body = await req.json().catch(() => null);
    const notificationId =
      typeof body?.notificationId === "string" ? body.notificationId.trim() : null;

    if (notificationId && notificationId.length > MAX_NOTIFICATION_ID_LENGTH) {
      return NextResponse.json(
        { error: "Invalid notification id" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (notificationId) {
      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId: user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return NextResponse.json(
        { ok: true, marked: "one" },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json(
      { ok: true, marked: "all" },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("notifications/read POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
