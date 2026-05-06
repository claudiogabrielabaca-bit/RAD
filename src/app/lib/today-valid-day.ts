import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

const GENERATION_BATCH_SIZE = 4;
const TARGET_POOL_MIN = 30;
const EMPTY_FALLBACK_TEXT = "No exact historical match was found for this date.";

type TodayValidDayResult = {
  day: string;
  source: "cache" | "generated";
  restartedRound: boolean;
};

type CachedHighlightRow = {
  day: string;
  type: string;
  title: string | null;
  text: string;
};

type CachedState = {
  testedDays: string[];
  validDays: string[];
};

type EnsureHighlightResult = Awaited<ReturnType<typeof ensureHighlightsForDay>>;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function shuffleArray<T>(items: T[]): T[] {
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
): string[] {
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

async function getPoolDaysForMonthDay(
  monthStr: string,
  dayStr: string
): Promise<string[]> {
  const monthDay = `${monthStr}-${dayStr}`;

  const row = await prisma.todayHistoryPool.findUnique({
    where: { monthDay },
    select: {
      validDays: true,
    },
  });

  return normalizePoolDays(row?.validDays as unknown, monthStr, dayStr);
}

async function savePoolDays(
  monthStr: string,
  dayStr: string,
  validDays: string[]
): Promise<string[]> {
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

function isUsableHighlight(result: EnsureHighlightResult) {
  const primary = result.highlight ?? result.highlights?.[0] ?? null;

  return !!(
    primary &&
    primary.type !== "none" &&
    primary.title &&
    primary.title.trim().length > 0 &&
    primary.text &&
    primary.text.trim().length > 0 &&
    primary.text.trim() !== EMPTY_FALLBACK_TEXT
  );
}

function isUsableCachedRow(row: CachedHighlightRow) {
  return (
    row.type !== "none" &&
    !!row.title?.trim() &&
    !!row.text?.trim() &&
    row.text.trim() !== EMPTY_FALLBACK_TEXT
  );
}

function getValidYearsForMonthDay(month: number, day: number): string[] {
  const minYear = 1800;
  const maxYear = new Date().getFullYear();
  const days: string[] = [];

  for (let year = minYear; year <= maxYear; year++) {
    if (month === 2 && day === 29 && !isLeapYear(year)) {
      continue;
    }

    days.push(`${year}-${pad2(month)}-${pad2(day)}`);
  }

  return days;
}

async function getCachedStateForMonthDay(
  monthStr: string,
  dayStr: string
): Promise<CachedState> {
  const suffix = `-${monthStr}-${dayStr}`;

  const rows: CachedHighlightRow[] = await prisma.dayHighlightCache.findMany({
    where: {
      day: {
        endsWith: suffix,
      },
    },
    select: {
      day: true,
      type: true,
      title: true,
      text: true,
    },
    orderBy: {
      day: "asc",
    },
  });

  const testedDays = Array.from(
    new Set(rows.map((row: CachedHighlightRow) => row.day))
  ).sort();

  const validDays = Array.from(
    new Set(
      rows
        .filter((row: CachedHighlightRow) => isUsableCachedRow(row))
        .map((row: CachedHighlightRow) => row.day)
    )
  ).sort();

  return {
    testedDays,
    validDays,
  };
}

async function isUsableDay(candidate: string) {
  try {
    const result = await ensureHighlightsForDay(candidate);
    return isUsableHighlight(result);
  } catch {
    return false;
  }
}

async function pickValidatedFromPool(
  pooledDays: string[],
  excludedSet: Set<string>,
  restartedRound: boolean
): Promise<TodayValidDayResult | null> {
  if (pooledDays.length === 0) return null;

  const remainingDays = pooledDays.filter(
    (candidate: string) => !excludedSet.has(candidate)
  );

  if (remainingDays.length === 0) {
    return null;
  }

  const shuffled = shuffleArray(remainingDays);

  for (const candidate of shuffled) {
    const usable = await isUsableDay(candidate);

    if (usable) {
      return {
        day: candidate,
        source: "cache",
        restartedRound,
      };
    }
  }

  return null;
}

async function discoverUntilNextAvailable(
  candidates: string[],
  excludedSet: Set<string>
): Promise<{ selectedDay: string | null; discoveredValidDays: string[] }> {
  const discoveredValidDays: string[] = [];
  let selectedDay: string | null = null;

  for (let i = 0; i < candidates.length; i += GENERATION_BATCH_SIZE) {
    const batch = candidates.slice(i, i + GENERATION_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (candidate: string) => {
        const result = await ensureHighlightsForDay(candidate);

        return {
          candidate,
          usable: isUsableHighlight(result),
        };
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      if (!result.value.usable) continue;

      const candidate = result.value.candidate;

      discoveredValidDays.push(candidate);

      if (!selectedDay && !excludedSet.has(candidate)) {
        selectedDay = candidate;
      }
    }
  }

  return {
    selectedDay,
    discoveredValidDays: Array.from(new Set(discoveredValidDays)).sort(),
  };
}

export async function getTodayValidDay(options?: {
  fresh?: boolean;
  maxAttempts?: number;
  excludeDays?: string[];
  monthDay?: string;
}): Promise<TodayValidDayResult | null> {
  const excludeDays = Array.from(
    new Set((options?.excludeDays ?? []).filter(isValidDayString))
  );
  const excludedSet = new Set<string>(excludeDays);

  const { month, day } = parseMonthDay(options?.monthDay);
  const monthStr = pad2(month);
  const dayStr = pad2(day);

  const allCandidateDays = getValidYearsForMonthDay(month, day);

  /*
   * TodayHistoryPool.validDays is the persisted Today pool.
   * Do not throw it away just because those days are not currently present
   * in DayHighlightCache. That was the old bug that made a larger pool behave
   * like a much smaller one.
   */
  const rawStoredPool = await getPoolDaysForMonthDay(monthStr, dayStr);

  const cachedState = await getCachedStateForMonthDay(monthStr, dayStr);
  const cachedValidSet = new Set(cachedState.validDays);
  const testedSet = new Set<string>(cachedState.testedDays);

  /*
   * Remove only confirmed bad days:
   * - already tested in DayHighlightCache
   * - not usable there
   *
   * Stored TodayHistoryPool days that are not in DayHighlightCache are kept,
   * but every selected candidate is validated before being returned.
   */
  const confirmedBadSet = new Set(
    cachedState.testedDays.filter(
      (testedDay: string) => !cachedValidSet.has(testedDay)
    )
  );

  let pooledDays: string[] = Array.from(
    new Set<string>([
      ...rawStoredPool.filter(
        (candidate: string) => !confirmedBadSet.has(candidate)
      ),
      ...cachedState.validDays,
    ])
  ).sort();

  const rawStoredPoolSet = new Set<string>(rawStoredPool);
  const poolChanged =
    pooledDays.length !== rawStoredPool.length ||
    pooledDays.some((dayValue: string) => !rawStoredPoolSet.has(dayValue));

  if (poolChanged) {
    pooledDays = await savePoolDays(monthStr, dayStr, pooledDays);
  }

  /*
   * Critical fix:
   * Do not return a pooled day blindly.
   * Validate the selected candidate with ensureHighlightsForDay() before
   * returning it, so Today never shows a "No exact historical match" page.
   */
  const pooledPick = await pickValidatedFromPool(
    pooledDays,
    excludedSet,
    false
  );

  const pooledSet = new Set<string>(pooledDays);

  const rawUntestedCandidates = shuffleArray(
    allCandidateDays.filter(
      (candidate: string) =>
        !testedSet.has(candidate) && !pooledSet.has(candidate)
    )
  );

  const maxAttempts = Math.max(
    GENERATION_BATCH_SIZE,
    options?.maxAttempts ?? 72
  );

  const shouldBackfill =
    options?.fresh === true || pooledDays.length < TARGET_POOL_MIN;

  const untestedCandidates = shouldBackfill
    ? rawUntestedCandidates.slice(0, maxAttempts)
    : [];

  let generatedSelectedDay: string | null = null;

  if (untestedCandidates.length > 0) {
    const { selectedDay, discoveredValidDays } =
      await discoverUntilNextAvailable(untestedCandidates, excludedSet);

    if (discoveredValidDays.length > 0) {
      pooledDays = await savePoolDays(monthStr, dayStr, [
        ...pooledDays,
        ...discoveredValidDays,
      ]);
    }

    generatedSelectedDay = selectedDay;
  }

  if (options?.fresh === true && generatedSelectedDay) {
    return {
      day: generatedSelectedDay,
      source: "generated",
      restartedRound: false,
    };
  }

  if (pooledPick) {
    return pooledPick;
  }

  if (generatedSelectedDay) {
    return {
      day: generatedSelectedDay,
      source: "generated",
      restartedRound: false,
    };
  }

  /*
   * If all non-excluded stored pool days were exhausted, restart the local
   * round using the full stored pool, but still validate before returning.
   */
  const restartedPick = await pickValidatedFromPool(
    pooledDays,
    new Set<string>(),
    true
  );

  if (restartedPick) {
    return restartedPick;
  }

  return null;
}