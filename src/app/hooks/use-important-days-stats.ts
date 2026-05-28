import { useEffect, useState } from "react";
import { FEATURED_MOMENTS } from "@/app/lib/featured-moments";

export type MomentStats = {
  avg: number;
  count: number;
  views: number;
};

type DayStatsBatchResponse = {
  stats?: Record<string, MomentStats>;
};

export const EMPTY_IMPORTANT_DAY_STATS: MomentStats = {
  avg: 0,
  count: 0,
  views: 0,
};

const FALLBACK_STATS = EMPTY_IMPORTANT_DAY_STATS;

let importantDaysStatsCache: Record<string, MomentStats> | null = null;
let importantDaysStatsRequest: Promise<Record<string, MomentStats>> | null =
  null;

function buildFallbackStatsMap(days: string[]) {
  return Object.fromEntries(
    days.map((day) => [day, { ...FALLBACK_STATS }])
  ) as Record<string, MomentStats>;
}

function normalizeStatsMap(
  payload: DayStatsBatchResponse | null,
  days: string[]
) {
  const fallback = buildFallbackStatsMap(days);
  const stats = payload?.stats;

  if (!stats || typeof stats !== "object") {
    return fallback;
  }

  for (const day of days) {
    const item = stats[day];

    fallback[day] = {
      avg: typeof item?.avg === "number" ? item.avg : 0,
      count: typeof item?.count === "number" ? item.count : 0,
      views: typeof item?.views === "number" ? item.views : 0,
    };
  }

  return fallback;
}

async function loadImportantDaysStats(days: string[]) {
  const uniqueDays = Array.from(new Set(days));

  if (importantDaysStatsCache) {
    return importantDaysStatsCache;
  }

  if (importantDaysStatsRequest) {
    return importantDaysStatsRequest;
  }

  importantDaysStatsRequest = (async () => {
    try {
      const res = await fetch("/api/day-stats-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          days: uniqueDays,
        }),
      });

      if (!res.ok) {
        return buildFallbackStatsMap(uniqueDays);
      }

      const json = (await res.json().catch(() => null)) as
        | DayStatsBatchResponse
        | null;

      const stats = normalizeStatsMap(json, uniqueDays);
      importantDaysStatsCache = stats;

      return stats;
    } catch {
      return buildFallbackStatsMap(uniqueDays);
    } finally {
      importantDaysStatsRequest = null;
    }
  })();

  return importantDaysStatsRequest;
}

export function useImportantDaysStats() {
  const [statsByDay, setStatsByDay] = useState<Record<string, MomentStats>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      const days = FEATURED_MOMENTS.map((moment) => moment.day);
      const stats = await loadImportantDaysStats(days);

      if (!cancelled) {
        setStatsByDay(stats);
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  return statsByDay;
}
