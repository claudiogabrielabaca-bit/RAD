import type { SurpriseResponse } from "@/app/lib/rad-types";

export type TodayInHistoryResponse = SurpriseResponse & {
  restartedRound?: boolean;
};

type ErrorResponse = {
  error?: string;
};

async function fetchNoStoreJson<T>(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as T | null;

  return {
    res,
    json,
  };
}

export async function fetchPickDateBundle(targetDay: string) {
  const { res, json } = await fetchNoStoreJson<SurpriseResponse>(
    `/api/pick-date-bundle?day=${encodeURIComponent(targetDay)}`
  );

  if (!res.ok || !json?.day || !json?.dayData || !json?.highlightData) {
    throw new Error("Failed to load pick date bundle");
  }

  return json;
}

export function fetchSurpriseBundle(requestUrl: string) {
  return fetchNoStoreJson<SurpriseResponse>(requestUrl);
}

export function fetchRandomDayCandidate(requestUrl: string) {
  return fetchNoStoreJson<SurpriseResponse>(requestUrl);
}

export function fetchTodayHistoryRequest(requestUrl: string) {
  return fetchNoStoreJson<TodayInHistoryResponse | ErrorResponse>(requestUrl);
}
