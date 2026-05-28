import type { SurpriseResponse } from "@/app/lib/rad-types";

export async function fetchDayBundleRequest(
  targetDay: string,
  options?: {
    communityOnly?: boolean;
    signal?: AbortSignal;
  }
) {
  const params = new URLSearchParams({ day: targetDay });

  if (options?.communityOnly) {
    params.set("communityOnly", "1");
  }

  const res = await fetch("/api/day-bundle?" + params.toString(), {
    cache: "no-store",
    signal: options?.signal,
  });

  const json = (await res.json().catch(() => null)) as SurpriseResponse | null;

  if (!res.ok || !json?.day || !json?.dayData || !json?.highlightData) {
    throw new Error("Failed to load day bundle");
  }

  return json;
}
