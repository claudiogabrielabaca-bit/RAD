import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import HomePageClient from "@/app/home-page-client";
import { buildDayBundle } from "@/app/lib/day-bundle";
import { prisma } from "@/app/lib/prisma";

type ParamsInput =
  | Promise<{
      day?: string;
    }>
  | {
      day?: string;
    };

type MetadataHighlight = {
  title: string | null;
  text: string | null;
  image: string | null;
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

function readFirstHighlightFromJson(value: unknown): MetadataHighlight | null {
  if (!Array.isArray(value)) return null;

  const first = value[0];

  if (!first || typeof first !== "object") return null;

  const item = first as {
    title?: unknown;
    text?: unknown;
    image?: unknown;
  };

  return {
    title: typeof item.title === "string" ? item.title : null,
    text: typeof item.text === "string" ? item.text : null,
    image: typeof item.image === "string" ? item.image : null,
  };
}

const getCachedDayBundle = cache(async (day: string) => buildDayBundle(day));

const getCachedMetadataHighlight = cache(
  async (day: string): Promise<MetadataHighlight | null> => {
    try {
      const row = await prisma.dayHighlightCache.findUnique({
        where: {
          day,
        },
        select: {
          title: true,
          text: true,
          image: true,
          highlights: true,
        },
      });

      if (!row) return null;

      const directHighlight: MetadataHighlight = {
        title: row.title,
        text: row.text,
        image: row.image,
      };

      if (cleanText(directHighlight.title) || cleanText(directHighlight.text)) {
        return directHighlight;
      }

      return readFirstHighlightFromJson(row.highlights);
    } catch (error) {
      console.error("day metadata cache read error:", error);
      return null;
    }
  }
);

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

  const metadataHighlight = await getCachedMetadataHighlight(day);

  const highlightTitle = cleanText(metadataHighlight?.title);
  const highlightText = cleanText(metadataHighlight?.text);
  const imageUrl = getAbsoluteImageUrl(metadataHighlight?.image);

  const title = highlightTitle
    ? `${highlightTitle} — ${displayDate}`
    : `${displayDate} on RAD`;

  const description = truncateText(
    highlightText ||
      `Explore, rate and discuss ${displayDate} in human history on RAD.`,
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
