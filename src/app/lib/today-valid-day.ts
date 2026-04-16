import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

const GENERATION_BATCH_SIZE = 4;
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

function normalizePoolDays(raw: unknown, monthStr: string, dayStr: string) {
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
    where: { monthDay },
    select: {
      validDays: true,
    },
  });

  return normalizePoolDays(row?.validDays, monthStr, dayStr);
}

async function savePoolDays(monthStr: string, dayStr: string, validDays: string[]) {
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

function isUsableCachedRow(row: { type: string; text: string }) {
  return (
    row.type !== "none" &&
    !!row.text?.trim() &&
    row.text.trim() !== EMPTY_FALLBACK_TEXT
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

async function getCachedStateForMonthDay(monthStr: string, dayStr: string) {
  const suffix = `-${monthStr}-${dayStr}`;

  const rows = await prisma.dayHighlightCache.findMany({
    where: {
      day: {
        endsWith: suffix,
      },
    },
    select: {
      day: true,
      type: true,
      text: true,
    },
    orderBy: {
      day: "asc",
    },
  });

  const testedDays = Array.from(new Set(rows.map((row) => row.day))).sort();
  const validDays = Array.from(
    new Set(rows.filter(isUsableCachedRow).map((row) => row.day))
  ).sort();

  return {
    testedDays,
    validDays,
  };
}

function pickFromPool(pooledDays: string[], excludedSet: Set<string>) {
  if (pooledDays.length === 0) return null;

  const remainingDays = pooledDays.filter((candidate) => !excludedSet.has(candidate));

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

async function discoverUntilNextAvailable(
  candidates: string[],
  excludedSet: Set<string>
) {
  const discoveredValidDays: string[] = [];
  let selectedDay: string | null = null;

  for (let i = 0; i < candidates.length; i += GENERATION_BATCH_SIZE) {
    const batch = candidates.slice(i, i + GENERATION_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (candidate) => {
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

      const { candidate } = result.value;
      discoveredValidDays.push(candidate);

      if (!selectedDay && !excludedSet.has(candidate)) {
        selectedDay = candidate;
      }
    }

    if (selectedDay) {
      break;
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
}) {
  const excludeDays = Array.from(
    new Set((options?.excludeDays ?? []).filter(isValidDayString))
  );
  const excludedSet = new Set(excludeDays);

  const { month, day } = parseMonthDay(options?.monthDay);
  const monthStr = pad2(month);
  const dayStr = pad2(day);

  const allCandidateDays = getValidYearsForMonthDay(month, day).map(
    (year) => `${year}-${monthStr}-${dayStr}`
  );

  const storedPool = options?.fresh
    ? []
    : await getPoolDaysForMonthDay(monthStr, dayStr);

  const cachedState = await getCachedStateForMonthDay(monthStr, dayStr);

  let pooledDays = Array.from(
    new Set([...storedPool, ...cachedState.validDays])
  ).sort();

  const storedPoolSet = new Set(storedPool);
  const poolChanged =
    pooledDays.length !== storedPool.length ||
    pooledDays.some((dayValue) => !storedPoolSet.has(dayValue));

  if (poolChanged) {
    pooledDays = await savePoolDays(monthStr, dayStr, pooledDays);
  }

  const pooledPick = pickFromPool(pooledDays, excludedSet);
  if (pooledPick) {
    return pooledPick;
  }

  const testedSet = new Set(cachedState.testedDays);
  const untestedCandidates = shuffleArray(
    allCandidateDays.filter((candidate) => !testedSet.has(candidate))
  );

  if (untestedCandidates.length > 0) {
    const { selectedDay, discoveredValidDays } =
      await discoverUntilNextAvailable(untestedCandidates, excludedSet);

    if (discoveredValidDays.length > 0) {
      pooledDays = await savePoolDays(monthStr, dayStr, [
        ...pooledDays,
        ...discoveredValidDays,
      ]);
    }

    if (selectedDay) {
      return {
        day: selectedDay,
        source: "generated" as const,
        restartedRound: false,
      };
    }
  }

  if (pooledDays.length > 0) {
    const shuffled = shuffleArray(pooledDays);

    return {
      day: shuffled[0],
      source: "cache" as const,
      restartedRound: true,
    };
  }

  return null;
}