import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

const MIN_CACHE_POOL_FOR_MONTH_DAY = 12;
const TARGET_CACHE_POOL_FOR_MONTH_DAY = 24;
const GENERATION_BATCH_SIZE = 4;
const MAX_GENERATION_PROBES = 120;

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

function parseMonthDay(monthDay?: string | null) {
  if (monthDay && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(monthDay)) {
    const [month, day] = monthDay.split("-").map(Number);
    return { month, day };
  }

  const now = new Date();
  return {
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function isUsableHighlight(
  result: Awaited<ReturnType<typeof ensureHighlightsForDay>>
) {
  const primary = result.highlight ?? result.highlights?.[0] ?? null;

  return !!(
    primary &&
    primary.type !== "none" &&
    primary.text &&
    primary.text.trim().length > 0
  );
}

function getValidYearsForMonthDay(month: number, day: number) {
  const minYear = 1800;
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

function getDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

async function getCachedDaysForMonthDay(monthStr: string, dayStr: string) {
  const rows = await prisma.dayHighlightCache.findMany({
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

  return getUniqueDays(rows.map((item) => item.day));
}

function orderCandidateDaysForExpansion(args: {
  month: number;
  day: number;
  cachedDays: string[];
  excludeDays: string[];
}) {
  const { month, day, cachedDays, excludeDays } = args;
  const cachedSet = new Set(cachedDays);
  const excludeSet = new Set(excludeDays);

  const decadeUsage = new Map<number, number>();

  for (const cachedDay of cachedDays) {
    const year = Number(cachedDay.slice(0, 4));

    if (!Number.isFinite(year)) {
      continue;
    }

    const decade = getDecade(year);
    decadeUsage.set(decade, (decadeUsage.get(decade) ?? 0) + 1);
  }

  return shuffleArray(getValidYearsForMonthDay(month, day))
    .filter((year) => {
      const candidate = `${year}-${pad2(month)}-${pad2(day)}`;
      return !cachedSet.has(candidate) && !excludeSet.has(candidate);
    })
    .sort((a, b) => {
      const decadeDelta =
        (decadeUsage.get(getDecade(a)) ?? 0) -
        (decadeUsage.get(getDecade(b)) ?? 0);

      if (decadeDelta !== 0) {
        return decadeDelta;
      }

      const modernPenaltyA = a >= 2000 ? 1 : 0;
      const modernPenaltyB = b >= 2000 ? 1 : 0;

      if (modernPenaltyA !== modernPenaltyB) {
        return modernPenaltyA - modernPenaltyB;
      }

      return 0;
    })
    .map((year) => `${year}-${pad2(month)}-${pad2(day)}`);
}

async function tryCandidateBatches(
  candidates: string[],
  restartedRound: boolean
) {
  for (let i = 0; i < candidates.length; i += GENERATION_BATCH_SIZE) {
    const batch = candidates.slice(i, i + GENERATION_BATCH_SIZE);

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

async function findGeneratedCandidate(args: {
  candidates: string[];
  maxAttempts: number;
  restartedRound: boolean;
}) {
  const { candidates, maxAttempts, restartedRound } = args;

  if (candidates.length === 0) {
    return null;
  }

  const shuffled = shuffleArray(candidates);
  const fastPassSize = Math.max(1, Math.min(maxAttempts, shuffled.length));

  const fastPass = shuffled.slice(0, fastPassSize);
  const slowPass = shuffled.slice(fastPassSize);

  const fastResult = await tryCandidateBatches(fastPass, restartedRound);
  if (fastResult) {
    return fastResult;
  }

  if (slowPass.length === 0) {
    return null;
  }

  return tryCandidateBatches(slowPass, restartedRound);
}

async function expandMonthDayCacheIfNeeded(args: {
  month: number;
  day: number;
  monthStr: string;
  dayStr: string;
  cachedDays: string[];
  excludeDays: string[];
  maxAttempts: number;
}) {
  const {
    month,
    day,
    monthStr,
    dayStr,
    cachedDays,
    excludeDays,
    maxAttempts,
  } = args;

  if (cachedDays.length >= MIN_CACHE_POOL_FOR_MONTH_DAY) {
    return cachedDays;
  }

  const targetPoolSize = Math.max(
    MIN_CACHE_POOL_FOR_MONTH_DAY,
    Math.min(TARGET_CACHE_POOL_FOR_MONTH_DAY, cachedDays.length + maxAttempts)
  );

  const generationBudget = Math.min(
    MAX_GENERATION_PROBES,
    Math.max(maxAttempts * 2, targetPoolSize - cachedDays.length)
  );

  const candidateDays = orderCandidateDaysForExpansion({
    month,
    day,
    cachedDays,
    excludeDays,
  }).slice(0, generationBudget);

  if (candidateDays.length === 0) {
    return cachedDays;
  }

  await findGeneratedCandidate({
    candidates: candidateDays,
    maxAttempts: generationBudget,
    restartedRound: false,
  });

  return getCachedDaysForMonthDay(monthStr, dayStr);
}

export async function getTodayValidDay(options?: {
  fresh?: boolean;
  maxAttempts?: number;
  excludeDays?: string[];
  monthDay?: string;
}) {
  const fresh = options?.fresh ?? false;
  const maxAttempts = Math.max(1, Math.min(options?.maxAttempts ?? 72, 120));
  const excludeDays = getUniqueDays(options?.excludeDays ?? []);
  const excludedSet = new Set(excludeDays);

  const { month, day } = parseMonthDay(options?.monthDay);

  const monthStr = pad2(month);
  const dayStr = pad2(day);

  let allCachedDays = await getCachedDaysForMonthDay(monthStr, dayStr);

  allCachedDays = await expandMonthDayCacheIfNeeded({
    month,
    day,
    monthStr,
    dayStr,
    cachedDays: allCachedDays,
    excludeDays,
    maxAttempts,
  });

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
    const candidateDays = orderCandidateDaysForExpansion({
      month,
      day,
      cachedDays: allCachedDays,
      excludeDays: [],
    }).slice(0, Math.min(MAX_GENERATION_PROBES, maxAttempts * 2));

    const generatedFromRestartedRound = await findGeneratedCandidate({
      candidates: candidateDays,
      maxAttempts: candidateDays.length,
      restartedRound: true,
    });

    if (
      generatedFromRestartedRound &&
      !excludedSet.has(generatedFromRestartedRound.day)
    ) {
      return generatedFromRestartedRound;
    }

    const reusableCachedDays = allCachedDays.filter(
      (candidate) => !excludedSet.has(candidate)
    );

    if (reusableCachedDays.length > 0) {
      const shuffled = shuffleArray(reusableCachedDays);

      return {
        day: shuffled[0],
        source: "cache" as const,
        restartedRound: true,
      };
    }

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
      maxAttempts: Math.max(maxAttempts, 72),
      restartedRound: true,
    });

    if (generatedFromRestartedRound) {
      return generatedFromRestartedRound;
    }
  }

  return null;
}