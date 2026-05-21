import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

function formatDisplayDate(date: string) {
  const [year, month, day] = date.split("-");
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: ParamsInput;
}): Promise<Metadata> {
  const resolvedParams = await resolveParams(params);
  const day = resolvedParams.day;

  if (!isValidDayString(day)) {
    return {
      title: "RAD — Rate Any Day in Human History",
      description: "Explore, rate and discover any day in human history.",
    };
  }

  const displayDate = formatDisplayDate(day);
  const title = `${displayDate} on RAD`;
  const description = `Explore, rate and discuss ${displayDate} in human history.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/day/${day}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function DayPage({ params }: { params: ParamsInput }) {
  const resolvedParams = await resolveParams(params);
  const day = resolvedParams.day;

  if (!isValidDayString(day)) {
    notFound();
  }

  let initialBundle = null;

  try {
    initialBundle = await buildDayBundle(day);
  } catch (error) {
    console.error("day route initial bundle error:", error);
  }

  return <HomePageClient initialBundle={initialBundle} />;
}