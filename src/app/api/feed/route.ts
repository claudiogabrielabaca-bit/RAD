import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
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

const FEED_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const FEED_RATE_LIMIT_LIMIT = 120;

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike };

type JsonObjectLike = { [key: string]: JsonLike };

type FeedRatingRow = {
  id: string;
  day: string;
  stars: number;
  review: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    username: string;
  } | null;
  _count: {
    likes: number;
  };
};

type HighlightRow = {
  day: string;
  title: string | null;
  text: string;
  image: string | null;
  type: string;
  highlights: unknown;
};

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isJsonObject(value: unknown): value is JsonObjectLike {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getJsonString(
  obj: JsonObjectLike | null,
  key: string
): string | null {
  if (!obj) return null;

  const value = obj[key];
  return typeof value === "string" ? value : null;
}

export async function GET(req: Request) {
  try {
    const rateLimit = await consumeRateLimit({
      action: "feed",
      key: buildRateLimitKey(req),
      limit: FEED_RATE_LIMIT_LIMIT,
      windowMs: FEED_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many feed requests. Please try again later."
      );
    }

    const ratings: FeedRatingRow[] = await prisma.rating.findMany({
      where: {
        review: {
          not: "",
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: 60,
      select: {
        id: true,
        day: true,
        stars: true,
        review: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            username: true,
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    const filteredRatings = ratings.filter(
      (item: FeedRatingRow) => item.review.trim().length > 0
    );

    const days = Array.from(
      new Set(filteredRatings.map((item: FeedRatingRow) => item.day))
    );

    const highlights: HighlightRow[] = days.length
      ? await prisma.dayHighlightCache.findMany({
          where: {
            day: {
              in: days,
            },
          },
          select: {
            day: true,
            title: true,
            text: true,
            image: true,
            type: true,
            highlights: true,
          },
        })
      : [];

    const highlightMap = new Map<string, HighlightRow>(
      highlights.map((item: HighlightRow) => [item.day, item])
    );

    const items = filteredRatings.map((item: FeedRatingRow) => {
      const highlight = highlightMap.get(item.day) ?? null;

      const rawHighlights = highlight?.highlights;
      const firstHighlight =
        Array.isArray(rawHighlights) && rawHighlights.length > 0
          ? rawHighlights[0]
          : null;

      const firstHighlightObject = isJsonObject(firstHighlight)
        ? firstHighlight
        : null;

      const highlightType =
        getJsonString(firstHighlightObject, "type") ??
        (typeof highlight?.type === "string" ? highlight.type : null);

      const highlightCategory = getJsonString(firstHighlightObject, "category");

      const highlightSecondaryType = getJsonString(
        firstHighlightObject,
        "secondaryType"
      );

      return {
        id: item.id,
        day: item.day,
        displayDate: formatDisplayDate(item.day),
        username: item.user?.username ?? "user",
        review: item.review.trim(),
        stars: item.stars,
        likesCount: item._count.likes,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        highlightTitle: highlight?.title ?? null,
        highlightText: highlight?.text ?? null,
        highlightImage: highlight?.image ?? null,
        highlightType,
        highlightCategory,
        highlightSecondaryType,
      };
    });

    return NextResponse.json(
      { items },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("feed GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
