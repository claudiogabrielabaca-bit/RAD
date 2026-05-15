import { prisma } from "@/app/lib/prisma";

export type DayStatsSummary = {
  avg: number;
  count: number;
  views: number;
};

const EMPTY_DAY_STATS: DayStatsSummary = {
  avg: 0,
  count: 0,
  views: 0,
};

export function isValidStatsDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normalizeStatsDayList(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(isValidStatsDayString)
    )
  );
}

export async function getDayStatsMap(days: string[]) {
  const uniqueDays = normalizeStatsDayList(days);

  const result: Record<string, DayStatsSummary> = Object.fromEntries(
    uniqueDays.map((day) => [day, { ...EMPTY_DAY_STATS }])
  );

  if (uniqueDays.length === 0) {
    return result;
  }

  const [ratingRows, viewRows] = await Promise.all([
    prisma.rating.groupBy({
      by: ["day"],
      where: {
        day: {
          in: uniqueDays,
        },
      },
      _count: {
        _all: true,
      },
      _avg: {
        stars: true,
      },
    }),
    prisma.dayStats.findMany({
      where: {
        day: {
          in: uniqueDays,
        },
      },
      select: {
        day: true,
        views: true,
      },
    }),
  ]);

  for (const row of ratingRows) {
    result[row.day] = {
      ...result[row.day],
      avg: row._avg.stars ?? 0,
      count: row._count._all,
    };
  }

  for (const row of viewRows) {
    result[row.day] = {
      ...result[row.day],
      views: row.views,
    };
  }

  return result;
}