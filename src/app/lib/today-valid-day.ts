import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
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

function getRandomValidYearForToday(month: number, day: number) {
  const minYear = 1900;
  const maxYear = new Date().getFullYear();

  if (month === 2 && day === 29) {
    const leapYears: number[] = [];

    for (let year = minYear; year <= maxYear; year++) {
      if (isLeapYear(year)) {
        leapYears.push(year);
      }
    }

    if (leapYears.length === 0) return null;

    return leapYears[getRandomInt(0, leapYears.length - 1)];
  }

  return getRandomInt(minYear, maxYear);
}

export async function getTodayValidDay(options?: {
  fresh?: boolean;
  maxCacheTake?: number;
  maxAttempts?: number;
}) {
  const fresh = options?.fresh ?? false;
  const maxCacheTake = options?.maxCacheTake ?? 200;
  const maxAttempts = options?.maxAttempts ?? 12;

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const monthStr = pad2(month);
  const dayStr = pad2(day);

  if (!fresh) {
    const validDays = await prisma.dayHighlightCache.findMany({
      where: {
        day: {
          endsWith: `-${monthStr}-${dayStr}`,
        },
        type: {
          not: "none",
        },
        title: {
          not: null,
        },
      },
      select: {
        day: true,
      },
      take: maxCacheTake,
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (validDays.length > 0) {
      const randomIndex = Math.floor(Math.random() * validDays.length);
      return {
        day: validDays[randomIndex].day,
        source: "cache" as const,
      };
    }
  }

  const tried = new Set<string>();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const year = getRandomValidYearForToday(month, day);

    if (!year) {
      return null;
    }

    const candidate = `${year}-${monthStr}-${dayStr}`;

    if (tried.has(candidate)) {
      continue;
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
      console.error(`[today-valid-day] attempt failed for ${candidate}`, error);
    }
  }

  return null;
}