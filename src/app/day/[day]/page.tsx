import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import HomePageClient from "@/app/home-page-client";
import { buildDayBundle } from "@/app/lib/day-bundle";

type ParamsInput =
  | Promise<{
      day?: string;
    }>
  | {
      day?: string;
    };

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function resolveParams(params: ParamsInput) {
  return await Promise.resolve(params);
}

function formatDisplayDate(day: string) {
  const [year, month, date] = day.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function getAbsoluteImageUrl(value?: string | null) {
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return value;
  }

  return null;
}

const getCachedDayBundle = cache(async (day: string) => buildDayBundle(day));

export async function generateMetadata({
  params,
}: {
  params: ParamsInput;
}): Promise<Metadata> {
  const { day } = await resolveParams(params);

  if (!isValidDayString(day)) {
    return {
      title: "Day not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const displayDate = formatDisplayDate(day);
  const canonicalPath = `/day/${encodeURIComponent(day)}`;

  try {
    const bundle = await getCachedDayBundle(day);
    const highlight =
      bundle.highlightData.highlight ?? bundle.highlightData.highlights?.[0];

    const highlightTitle = cleanText(highlight?.title);
    const highlightText = cleanText(highlight?.text);
    const imageUrl = getAbsoluteImageUrl(highlight?.image);

    const title = highlightTitle
      ? `${highlightTitle} — ${displayDate}`
      : `${displayDate} on RAD`;

    const description = truncateText(
      highlightText || `Explore, rate and discuss ${displayDate} in human history on RAD.`,
      155
    );

    return {
      title,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title,
        description,
        url: canonicalPath,
        type: "article",
        siteName: "RAD",
        images: imageUrl
          ? [
              {
                url: imageUrl,
                alt: highlightTitle || `${displayDate} on RAD`,
              },
            ]
          : undefined,
      },
      twitter: {
        card: imageUrl ? "summary_large_image" : "summary",
        title,
        description,
        images: imageUrl ? [imageUrl] : undefined,
      },
    };
  } catch (error) {
    console.error("day metadata error:", error);

    return {
      title: `${displayDate} on RAD`,
      description: `Explore, rate and discuss ${displayDate} in human history on RAD.`,
      alternates: {
        canonical: canonicalPath,
      },
    };
  }
}

export default async function DayPage({
  params,
}: {
  params: ParamsInput;
}) {
  const { day } = await resolveParams(params);

  if (!isValidDayString(day)) {
    notFound();
  }

  let initialBundle = null;

  try {
    initialBundle = await getCachedDayBundle(day);
  } catch (error) {
    console.error("day page initial bundle error:", error);
  }

  return <HomePageClient initialBundle={initialBundle} />;
}
