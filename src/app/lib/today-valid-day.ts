import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
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

function getValidYearsForMonthDay(month: number, day: number) {
  const minYear = 1900;
  const maxYear = new Date().getFullYear();
  const years: number[] = [];

  for (let year = minYear; year <= maxYear; year++) {
    if (month === 2 && day === 29 && !isLeapYear(year)) {
      continue;
    }

    years.push(year);
  }

  return years;
}

function getUniqueDays(days: string[]) {
  return Array.from(new Set(days.filter(Boolean)));
}

async function findTodayValidDayFromCandidates(args: {
  candidates: string[];
  fresh: boolean;
  maxAttempts: number;
  restartedRound: boolean;
}) {
  const { candidates, fresh, maxAttempts, restartedRound } = args;

  if (candidates.length === 0) {
    return null;
  }

  if (!fresh) {
    const cachedValidDays = await prisma.dayHighlightCache.findMany({
      where: {
        day: {
          in: candidates,
        },
        type: {
          not: "none",
        },
        title: {
          not: null,
        },
        text: {
          not: "",
        },
      },
      select: {
        day: true,
      },
    });

    const shuffledCachedDays = shuffleArray(
      cachedValidDays.map((item) => item.day)
    );

    if (shuffledCachedDays.length > 0) {
      return {
        day: shuffledCachedDays[0],
        source: "cache" as const,
        restartedRound,
      };
    }
  }

  const shuffledCandidates = shuffleArray(candidates);
  const attemptLimit = Math.min(maxAttempts, shuffledCandidates.length);

  for (let attempt = 0; attempt < attemptLimit; attempt++) {
    const candidate = shuffledCandidates[attempt];

    try {
      const result = await ensureHighlightsForDay(candidate);

      if (isUsableHighlight(result)) {
        return {
          day: candidate,
          source: "generated" as const,
          restartedRound,
        };
      }
    } catch (error) {
      console.error(`[today-valid-day] attempt failed for ${candidate}`, error);
    }
  }

  return null;
}

export async function getTodayValidDay(options?: {
  fresh?: boolean;
  maxCacheTake?: number;
  maxAttempts?: number;
  excludeDays?: string[];
}) {
  const fresh = options?.fresh ?? false;
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 160);
  const excludeDays = getUniqueDays(options?.excludeDays ?? []);
  const excludedSet = new Set(excludeDays);

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const monthStr = pad2(month);
  const dayStr = pad2(day);

  const candidateYears = getValidYearsForMonthDay(month, day);
  const candidateDays = candidateYears.map(
    (year) => `${year}-${monthStr}-${dayStr}`
  );

  const remainingCandidateDays = candidateDays.filter(
    (candidate) => !excludedSet.has(candidate)
  );

  const fromCurrentRound = await findTodayValidDayFromCandidates({
    candidates: remainingCandidateDays,
    fresh,
    maxAttempts,
    restartedRound: false,
  });

  if (fromCurrentRound) {
    return fromCurrentRound;
  }

  if (excludeDays.length === 0) {
    return null;
  }

  const fromRestartedRound = await findTodayValidDayFromCandidates({
    candidates: candidateDays,
    fresh,
    maxAttempts,
    restartedRound: true,
  });

  return fromRestartedRound;
}