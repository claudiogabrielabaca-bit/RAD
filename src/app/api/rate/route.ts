import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { isValidDayString } from "@/app/lib/day";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

function clampStars(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.floor(n)));
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to rate days." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (user.emailVerified === false) {
      return NextResponse.json(
        { error: "You must verify your email to rate days." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "rate",
      key: buildRateLimitKey(req, user.id),
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many rating attempts. Please try again later."
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Bad JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const { day, stars, review } = body as {
      day?: string;
      stars?: number;
      review?: string;
    };

    if (!isValidDayString(day)) {
      return NextResponse.json(
        { error: "Invalid day" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const s = clampStars(Number(stars));
    if (s < 1 || s > 5) {
      return NextResponse.json(
        { error: "Invalid stars" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const text = (review ?? "").toString().trim();

    if (text.length > 280) {
      return NextResponse.json(
        { error: "Review too long (max 280)" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await prisma.rating.upsert({
      where: {
        userId_day: {
          userId: user.id,
          day,
        },
      },
      update: {
        stars: s,
        review: text,
        anonId: null,
      },
      create: {
        userId: user.id,
        anonId: null,
        day,
        stars: s,
        review: text,
      },
    });

    return NextResponse.json(
      { ok: true },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("rate POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}