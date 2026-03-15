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

async function findGeneratedCandidate(args: {
  candidates: string[];
  maxAttempts: number;
  restartedRound: boolean;
}) {
  const { candidates, maxAttempts, restartedRound } = args;

  if (candidates.length === 0) {
    return null;
  }

  const shuffled = shuffleArray(candidates).slice(0, Math.max(1, maxAttempts));
  const batchSize = 3;

  for (let i = 0; i < shuffled.length; i += batchSize) {
    const batch = shuffled.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (candidate) => {
        const result = await ensureHighlightsForDay(candidate);

        if (isUsableHighlight(result)) {
          return candidate;
        }

        return null;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        return {
          day: result.value,
          source: "generated" as const,
          restartedRound,
        };
      }
    }
  }

  return null;
}

export async function getTodayValidDay(options?: {
  fresh?: boolean;
  maxAttempts?: number;
  excludeDays?: string[];
}) {
  const fresh = options?.fresh ?? false;
  const maxAttempts = Math.max(1, Math.min(options?.maxAttempts ?? 6, 12));
  const excludeDays = getUniqueDays(options?.excludeDays ?? []);
  const excludedSet = new Set(excludeDays);

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const monthStr = pad2(month);
  const dayStr = pad2(day);

  const allCachedRows = await prisma.dayHighlightCache.findMany({
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
      text: {
        not: "",
      },
    },
    select: {
      day: true,
    },
  });

  const allCachedDays = getUniqueDays(allCachedRows.map((item) => item.day));
  const remainingCachedDays = allCachedDays.filter(
    (candidate) => !excludedSet.has(candidate)
  );

  if (!fresh && remainingCachedDays.length > 0) {
    const shuffled = shuffleArray(remainingCachedDays);

    return {
      day: shuffled[0],
      source: "cache" as const,
      restartedRound: false,
    };
  }

  if (!fresh && allCachedDays.length > 0) {
    const shuffled = shuffleArray(allCachedDays);

    return {
      day: shuffled[0],
      source: "cache" as const,
      restartedRound: true,
    };
  }

  const candidateYears = getValidYearsForMonthDay(month, day);
  const candidateDays = candidateYears.map(
    (year) => `${year}-${monthStr}-${dayStr}`
  );

  const remainingCandidateDays = candidateDays.filter(
    (candidate) => !excludedSet.has(candidate)
  );

  const generatedFromCurrentRound = await findGeneratedCandidate({
    candidates: remainingCandidateDays,
    maxAttempts,
    restartedRound: false,
  });

  if (generatedFromCurrentRound) {
    return generatedFromCurrentRound;
  }

  if (excludeDays.length > 0) {
    const generatedFromRestartedRound = await findGeneratedCandidate({
      candidates: candidateDays,
      maxAttempts,
      restartedRound: true,
    });

    if (generatedFromRestartedRound) {
      return generatedFromRestartedRound;
    }
  }

  return null;
}