import HomePageClient from "./home-page-client";
import { buildDayBundle } from "@/app/lib/day-bundle";

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

async function resolveSearchParams(searchParams: SearchParamsInput) {
  if (!searchParams) return {};
  return await Promise.resolve(searchParams);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: SearchParamsInput;
}) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const requestedDay = Array.isArray(resolvedSearchParams.day)
    ? resolvedSearchParams.day[0]
    : resolvedSearchParams.day;

  let initialBundle = null;

  try {
    if (isValidDayString(requestedDay)) {
      initialBundle = await buildDayBundle(requestedDay);
    }
  } catch (error) {
    console.error("page initial bundle error:", error);
  }

  return <HomePageClient initialBundle={initialBundle} />;
}