import type { MetadataRoute } from "next";
import { FEATURED_MOMENTS } from "@/app/lib/featured-moments";
import { prisma } from "@/app/lib/prisma";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://rateanyday.com";

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayUrl(day: string) {
  return `${siteUrl}/day/${encodeURIComponent(day)}`;
}

async function getRatedDays() {
  try {
    const rows = await prisma.rating.groupBy({
      by: ["day"],
      _count: {
        day: true,
      },
      orderBy: {
        _count: {
          day: "desc",
        },
      },
      take: 120,
    });

    return rows.map((row) => row.day).filter(isValidDayString);
  } catch (error) {
    console.error("sitemap rated days error:", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const featuredDays = FEATURED_MOMENTS.map((item) => item.day).filter(
    isValidDayString
  );

  const ratedDays = await getRatedDays();

  const publicDays = Array.from(new Set([...featuredDays, ...ratedDays])).slice(
    0,
    160
  );

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/ranked-days`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/important-days`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${siteUrl}/feed`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.65,
    },
    ...publicDays.map((day) => ({
      url: dayUrl(day),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: featuredDays.includes(day) ? 0.72 : 0.6,
    })),
  ];
}
