import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

const MIN_YEAR = 1900;
const MAX_EXCLUDE_DAYS = 30;
const YEAR_BUCKET_ATTEMPTS = 3;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeExcludeDays(excludeDays?: string[]) {
  if (!excludeDays?.length) return [];

  return Array.from(
    new Set(excludeDays.map((item) => item.trim()).filter(isValidDayString))
  ).slice(0, MAX_EXCLUDE_DAYS);
}

function getTodayDayString() {
  return new Date().toISOString().slice(0, 10);
}

function getRandomDateBetween1900AndToday() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const year = getRandomInt(MIN_YEAR, currentYear);
  const maxMonth = year === currentYear ? currentMonth : 12;
  const month = getRandomInt(1, maxMonth);

  const maxDay =
    year === currentYear && month === currentMonth
      ? currentDay
      : getDaysInMonth(year, month);

  const day = getRandomInt(1, maxDay);

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function buildValidCacheWhere(excludeDays: string[] = [], year?: number) {
  const dayFilter: {
    notIn?: string[];
    gte?: string;
    lte?: string;
  } = {};

  if (excludeDays.length > 0) {
    dayFilter.notIn = excludeDays;
  }

  if (typeof year === "number") {
    dayFilter.gte = `${year}-01-01`;
    dayFilter.lte =
      year === new Date().getFullYear() ? getTodayDayString() : `${year}-12-31`;
  }

  return {
    type: {
      not: "none" as const,
    },
    title: {
      not: null as null | string,
    },
    day: Object.keys(dayFilter).length > 0 ? dayFilter : undefined,
  };
}

async function pickRandomCachedDay(excludeDays: string[] = [], year?: number) {
  const where = buildValidCacheWhere(excludeDays, year);

  const total = await prisma.dayHighlightCache.count({ where });

  if (total <= 0) {
    return null;
  }

  const offset = getRandomInt(0, total - 1);

  const rows = await prisma.dayHighlightCache.findMany({
    where,
    select: {
      day: true,
    },
    orderBy: {
      day: "asc",
    },
    skip: offset,
    take: 1,
  });

  return rows[0]?.day ?? null;
}

async function pickRandomCachedDayWithYearDispersion(excludeDays: string[]) {
  const currentYear = new Date().getFullYear();
  const triedYears = new Set<number>();

  for (let i = 0; i < YEAR_BUCKET_ATTEMPTS; i++) {
    let year = getRandomInt(MIN_YEAR, currentYear);

    while (triedYears.has(year) && triedYears.size < currentYear - MIN_YEAR + 1) {
      year = getRandomInt(MIN_YEAR, currentYear);
    }

    triedYears.add(year);

    const day = await pickRandomCachedDay(excludeDays, year);
    if (day) {
      return day;
    }
  }

  return pickRandomCachedDay(excludeDays);
}

function isUsableHighlight(
  result: Awaited<ReturnType<typeof ensureHighlightsForDay>>
) {
  const highlight = result.highlight;

  return !!(
    highlight &&
    highlight.type !== "none" &&
    highlight.text &&
    highlight.text.trim().length > 0
  );
}

export async function getRandomValidDay(options?: {
  fresh?: boolean;
  maxAttempts?: number;
  excludeDays?: string[];
}) {
  const fresh = options?.fresh ?? false;
  const maxAttempts = options?.maxAttempts ?? 12;
  const excludeDays = normalizeExcludeDays(options?.excludeDays);

  if (!fresh) {
    const cachedDay = await pickRandomCachedDayWithYearDispersion(excludeDays);

    if (cachedDay) {
      return {
        day: cachedDay,
        source: "cache" as const,
      };
    }
  }

  const tried = new Set<string>(excludeDays);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let candidate = getRandomDateBetween1900AndToday();

    while (tried.has(candidate)) {
      candidate = getRandomDateBetween1900AndToday();
    }

    tried.add(candidate);

    try {
      const result = await ensureHighlightsForDay(candidate);

      if (isUsableHighlight(result)) {
        return {
          day: candidate,
          source: "generated" as const,
        };
      }
    } catch (error) {
      console.error(`[random-valid-day] attempt failed for ${candidate}`, error);
    }
  }

  if (!fresh && excludeDays.length > 0) {
    const fallbackCachedDay = await pickRandomCachedDay();

    if (fallbackCachedDay) {
      return {
        day: fallbackCachedDay,
        source: "cache" as const,
      };
    }
  }

  return null;
}