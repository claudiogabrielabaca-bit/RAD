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

const BIO_MAX_LENGTH = 160;
const BIO_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const BIO_RATE_LIMIT_LIMIT = 10;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (user.emailVerified === false) {
      return NextResponse.json(
        { error: "You must verify your email to update your profile." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "profile-bio",
      key: buildRateLimitKey(req, user.id),
      limit: BIO_RATE_LIMIT_LIMIT,
      windowMs: BIO_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many profile updates. Please try again later."
      );
    }

    const body = await req.json().catch(() => null);
    const bioValue = body?.bio;

    if (typeof bioValue !== "string") {
      return NextResponse.json(
        { error: "Invalid bio." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const bio = bioValue.slice(0, BIO_MAX_LENGTH).trim();

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        bio: bio.length ? bio : null,
      },
      select: {
        bio: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        bio: updatedUser.bio ?? "",
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("profile bio POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}