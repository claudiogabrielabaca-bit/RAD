import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

const GENERATION_BATCH_SIZE = 4;
const GENERATION_TARGET_VALID_DAYS = 12;
const GENERATION_MAX_PROBED_CANDIDATES = 72;
const EMPTY_FALLBACK_TEXT = "No exact historical match was found for this date.";

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

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizePoolDays(
  raw: unknown,
  monthStr: string,
  dayStr: string
) {
  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(
      raw.filter(
        (item): item is string =>
          typeof item === "string" &&
          isValidDayString(item) &&
          item.endsWith(`-${monthStr}-${dayStr}`)
      )
    )
  ).sort();
}

async function getPoolDaysForMonthDay(monthStr: string, dayStr: string) {
  const monthDay = `${monthStr}-${dayStr}`;

  const row = await prisma.todayHistoryPool.findUnique({
    where: {
      monthDay,
    },
    select: {
      validDays: true,
    },
  });

  return normalizePoolDays(row?.validDays, monthStr, dayStr);
}

async function savePoolDays(
  monthStr: string,
  dayStr: string,
  validDays: string[]
) {
  const monthDay = `${monthStr}-${dayStr}`;
  const normalized = normalizePoolDays(validDays, monthStr, dayStr);

  await prisma.todayHistoryPool.upsert({
    where: { monthDay },
    update: {
      validDays: normalized,
      validCount: normalized.length,
    },
    create: {
      monthDay,
      validDays: normalized,
      validCount: normalized.length,
    },
  });

  return normalized;
}

function isUsableHighlight(
  result: Awaited<ReturnType<typeof ensureHighlightsForDay>>
) {
  const primary = result.highlight ?? result.highlights?.[0] ?? null;

  return !!(
    primary &&
    primary.type !== "none" &&
    primary.text &&
    primary.text.trim().length > 0 &&
    primary.text.trim() !== EMPTY_FALLBACK_TEXT
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

async function buildPoolDaysFromHighlightCache(
  monthStr: string,
  dayStr: string
) {
  const suffix = `-${monthStr}-${dayStr}`;

  const rows = await prisma.dayHighlightCache.findMany({
    where: {
      day: {
        endsWith: suffix,
      },
      type: {
        not: "none",
      },
      text: {
        not: EMPTY_FALLBACK_TEXT,
      },
    },
    select: {
      day: true,
    },
    orderBy: {
      day: "asc",
    },
  });

  const validDays = rows.map((row) => row.day);
  return savePoolDays(monthStr, dayStr, validDays);
}

function pickFromPool(
  pooledDays: string[],
  excludedSet: Set<string>
) {
  if (pooledDays.length === 0) return null;

  const remainingDays = pooledDays.filter(
    (candidate) => !excludedSet.has(candidate)
  );

  if (remainingDays.length > 0) {
    const shuffled = shuffleArray(remainingDays);

    return {
      day: shuffled[0],
      source: "cache" as const,
      restartedRound: false,
    };
  }

  const shuffled = shuffleArray(pooledDays);

  return {
    day: shuffled[0],
    source: "cache" as const,
    restartedRound: true,
  };
}

async function generateAdditionalPoolDays(
  month: number,
  day: number,
  monthStr: string,
  dayStr: string,
  existingPool: string[],
  maxCandidatesToProbe: number
) {
  const existingSet = new Set(existingPool);
  const candidateYears = getValidYearsForMonthDay(month, day);

  const candidateDays = shuffleArray(
    candidateYears
      .map((year) => `${year}-${monthStr}-${dayStr}`)
      .filter((candidate) => !existingSet.has(candidate))
  ).slice(0, maxCandidatesToProbe);

  const discovered: string[] = [];

  for (let i = 0; i < candidateDays.length; i += GENERATION_BATCH_SIZE) {
    const batch = candidateDays.slice(i, i + GENERATION_BATCH_SIZE);

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
        discovered.push(result.value);
      }
    }

    if (existingPool.length + discovered.length >= GENERATION_TARGET_VALID_DAYS) {
      break;
    }
  }

  if (discovered.length === 0) {
    return existingPool;
  }

  return savePoolDays(monthStr, dayStr, [...existingPool, ...discovered]);
}

export async function getTodayValidDay(options?: {
  fresh?: boolean;
  maxAttempts?: number;
  excludeDays?: string[];
  monthDay?: string;
}) {
  const excludeDays = Array.from(
    new Set((options?.excludeDays ?? []).filter(isValidDayString))
  );
  const excludedSet = new Set(excludeDays);

  const { month, day } = parseMonthDay(options?.monthDay);
  const monthStr = pad2(month);
  const dayStr = pad2(day);

  if (!options?.fresh) {
    const pooledDays = await getPoolDaysForMonthDay(monthStr, dayStr);
    const pooledPick = pickFromPool(pooledDays, excludedSet);

    if (pooledPick) {
      return pooledPick;
    }
  }

  let pooledDays = await buildPoolDaysFromHighlightCache(monthStr, dayStr);
  let pooledPick = pickFromPool(pooledDays, excludedSet);

  if (pooledPick) {
    return pooledPick;
  }

  const maxCandidatesToProbe = Math.max(
    12,
    Math.min(options?.maxAttempts ?? GENERATION_MAX_PROBED_CANDIDATES, 120)
  );

  pooledDays = await generateAdditionalPoolDays(
    month,
    day,
    monthStr,
    dayStr,
    pooledDays,
    maxCandidatesToProbe
  );

  pooledPick = pickFromPool(pooledDays, excludedSet);

  if (pooledPick) {
    return pooledPick;
  }

  return null;
}