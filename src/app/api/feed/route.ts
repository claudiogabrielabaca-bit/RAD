import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isJsonObject(
  value: Prisma.JsonValue | null | undefined
): value is Prisma.JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getJsonString(
  obj: Prisma.JsonObject | null,
  key: string
): string | null {
  if (!obj) return null;

  const value = obj[key];
  return typeof value === "string" ? value : null;
}

export async function GET() {
  try {
    const ratings = await prisma.rating.findMany({
      where: {
        review: {
          not: "",
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
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
      (item) => item.review.trim().length > 0
    );

    const days = Array.from(new Set(filteredRatings.map((item) => item.day)));

    const highlights = days.length
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

    const highlightMap = new Map(highlights.map((item) => [item.day, item]));

    const items = filteredRatings.map((item) => {
      const highlight = highlightMap.get(item.day);

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
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("feed GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}