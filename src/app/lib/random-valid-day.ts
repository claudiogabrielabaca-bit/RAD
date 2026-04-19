import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

export type CachedHighlightSample = {
  day: string;
  title: string | null;
  text: string;
  image: string | null;
  type: string;
};

type RandomValidDayOptions = {
  fresh?: boolean;
  maxCacheTake?: number;
  maxAttempts?: number;
  excludeDays?: string[];
};

type RandomValidDayResult = {
  day: string;
  source: "cache" | "generated";
};

const RANDOM_MIN_YEAR = 1800;
const MONTH_COOLDOWN = 4;
const YEAR_COOLDOWN = 6;
const DECADE_COOLDOWN = 4;
const MONTH_DAY_COOLDOWN = 12;

type EraBucket = "nineteenth" | "twentieth" | "twentyFirst";

type HistoryState = {
  monthUsage: Map<number, number>;
  yearUsage: Map<number, number>;
  decadeUsage: Map<number, number>;
  eraUsage: Map<EraBucket, number>;
  monthDayUsage: Map<string, number>;
  dayOfMonthUsage: Map<number, number>;
  recentMonths: number[];
  recentYears: number[];
  recentDecades: number[];
  recentMonthDays: string[];
};

type CachedHighlightRow = {
  day: string;
  title: string | null;
  text: string;
  image: string | null;
  type: string;
};

type CacheDayRow = {
  day: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function parseYear(day: string) {
  return Number(day.slice(0, 4));
}

function parseMonth(day: string) {
  return Number(day.slice(5, 7));
}

function parseDayOfMonth(day: string) {
  return Number(day.slice(8, 10));
}

function parseMonthDay(day: string) {
  return day.slice(5, 10);
}

function getDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

function getEraBucketFromYear(year: number): EraBucket {
  if (year >= 1800 && year <= 1899) return "nineteenth";
  if (year >= 2000) return "twentyFirst";
  return "twentieth";
}

function getEraBucket(day: string): EraBucket {
  return getEraBucketFromYear(parseYear(day));
}

function getUniqueDays(days: string[]) {
  return Array.from(new Set(days.filter(Boolean)));
}

function incrementMapCount<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildHistoryState(historyDays: string[]): HistoryState {
  const monthUsage = new Map<number, number>();
  const yearUsage = new Map<number, number>();
  const decadeUsage = new Map<number, number>();
  const eraUsage = new Map<EraBucket, number>();
  const monthDayUsage = new Map<string, number>();
  const dayOfMonthUsage = new Map<number, number>();

  const validHistory = historyDays.filter((day) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day)
  );

  for (const day of validHistory) {
    const year = parseYear(day);
    const month = parseMonth(day);
    const decade = getDecade(year);
    const era = getEraBucket(day);
    const monthDay = parseMonthDay(day);
    const dayOfMonth = parseDayOfMonth(day);

    incrementMapCount(monthUsage, month);
    incrementMapCount(yearUsage, year);
    incrementMapCount(decadeUsage, decade);
    incrementMapCount(eraUsage, era);
    incrementMapCount(monthDayUsage, monthDay);
    incrementMapCount(dayOfMonthUsage, dayOfMonth);
  }

  return {
    monthUsage,
    yearUsage,
    decadeUsage,
    eraUsage,
    monthDayUsage,
    dayOfMonthUsage,
    recentMonths: validHistory.map(parseMonth).slice(-MONTH_COOLDOWN),
    recentYears: validHistory.map(parseYear).slice(-YEAR_COOLDOWN),
    recentDecades: validHistory
      .map((day) => getDecade(parseYear(day)))
      .slice(-DECADE_COOLDOWN),
    recentMonthDays: validHistory.map(parseMonthDay).slice(-MONTH_DAY_COOLDOWN),
  };
}

function pickWeightedRandomItem<T>(
  entries: Array<{ value: T; weight: number }>
): T | null {
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce(
    (acc: number, item: { value: T; weight: number }) => acc + item.weight,
    0
  );

  if (totalWeight <= 0) {
    return shuffleArray(entries.map((item: { value: T; weight: number }) => item.value))[0] ?? null;
  }

  let roll = Math.random() * totalWeight;

  for (const item of entries) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.value;
    }
  }

  return entries[entries.length - 1]?.value ?? null;
}

function pickBalancedEra(state: HistoryState): EraBucket {
  const choices: Array<{ value: EraBucket; weight: number }> = [
    {
      value: "nineteenth",
      weight: 1 / Math.pow((state.eraUsage.get("nineteenth") ?? 0) + 1, 1.2),
    },
    {
      value: "twentieth",
      weight: 1 / Math.pow((state.eraUsage.get("twentieth") ?? 0) + 1, 1.15),
    },
    {
      value: "twentyFirst",
      weight: 1 / Math.pow((state.eraUsage.get("twentyFirst") ?? 0) + 1, 1.1),
    },
  ];

  return pickWeightedRandomItem(choices) ?? "twentieth";
}

function pickBalancedMonth(state: HistoryState, maxMonth = 12) {
  const months = Array.from({ length: maxMonth }, (_, index) => index + 1);
  const nonRecentMonths = months.filter(
    (month) => !state.recentMonths.includes(month)
  );
  const candidateMonths = nonRecentMonths.length > 0 ? nonRecentMonths : months;

  const minUsage = Math.min(
    ...candidateMonths.map((month) => state.monthUsage.get(month) ?? 0)
  );

  const best = candidateMonths.filter(
    (month) => (state.monthUsage.get(month) ?? 0) === minUsage
  );

  return shuffleArray(best)[0] ?? getRandomInt(1, maxMonth);
}

function pickBalancedYear(
  state: HistoryState,
  era: EraBucket,
  month: number,
  currentYear: number
) {
  let yearMin = RANDOM_MIN_YEAR;
  let yearMax = currentYear;

  if (era === "nineteenth") {
    yearMin = 1800;
    yearMax = 1899;
  } else if (era === "twentieth") {
    yearMin = 1900;
    yearMax = 1999;
  } else {
    yearMin = 2000;
    yearMax = currentYear;
  }

  const candidates: number[] = [];

  for (let year = yearMin; year <= yearMax; year += 1) {
    if (year === currentYear && month > new Date().getMonth() + 1) continue;
    candidates.push(year);
  }

  const nonRecentYears = candidates.filter(
    (year) => !state.recentYears.includes(year)
  );
  const candidateYears = nonRecentYears.length > 0 ? nonRecentYears : candidates;

  const minUsage = Math.min(
    ...candidateYears.map((year) => state.yearUsage.get(year) ?? 0)
  );

  const best = candidateYears.filter(
    (year) => (state.yearUsage.get(year) ?? 0) === minUsage
  );

  return shuffleArray(best)[0] ?? candidateYears[0] ?? currentYear;
}

function generateCandidateDate(state: HistoryState) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const era = pickBalancedEra(state);
  const month = pickBalancedMonth(state);
  const year = pickBalancedYear(state, era, month, currentYear);

  const maxMonth = year === currentYear ? now.getMonth() + 1 : 12;
  const safeMonth = Math.min(month, maxMonth);
  const maxDay =
    year === currentYear && safeMonth === now.getMonth() + 1
      ? now.getDate()
      : getDaysInMonth(year, safeMonth);

  const day = getRandomInt(1, maxDay);

  return `${year}-${pad2(safeMonth)}-${pad2(day)}`;
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

function scoreDayAgainstHistory(day: string, state: HistoryState) {
  const year = parseYear(day);
  const month = parseMonth(day);
  const dayOfMonth = parseDayOfMonth(day);
  const monthDay = parseMonthDay(day);
  const decade = getDecade(year);
  const era = getEraBucket(day);

  let score =
    (state.monthUsage.get(month) ?? 0) * 7 +
    (state.yearUsage.get(year) ?? 0) * 14 +
    (state.decadeUsage.get(decade) ?? 0) * 5.5 +
    (state.eraUsage.get(era) ?? 0) * 1.3 +
    (state.monthDayUsage.get(monthDay) ?? 0) * 18 +
    (state.dayOfMonthUsage.get(dayOfMonth) ?? 0) * 0.5;

  if (state.recentMonths.includes(month)) score += 60;
  if (state.recentYears.includes(year)) score += 120;
  if (state.recentDecades.includes(decade)) score += 36;
  if (state.recentMonthDays.includes(monthDay)) score += 220;

  return score;
}

function pickBalancedDay(days: string[], state: HistoryState) {
  const uniqueDays = getUniqueDays(days);

  if (uniqueDays.length === 0) return null;
  if (uniqueDays.length === 1) return uniqueDays[0];

  const scored = uniqueDays.map((day) => ({
    value: day,
    score: scoreDayAgainstHistory(day, state),
  }));

  scored.sort((a, b) => a.score - b.score);

  const bestScore = scored[0]?.score ?? 0;
  const nearBest = scored.filter((item) => item.score <= bestScore + 3);
  const choicePool = nearBest.slice(0, 12);

  return shuffleArray(choicePool)[0]?.value ?? scored[0]?.value ?? null;
}

export async function sampleRandomCachedHighlights(options?: {
  sampleSize?: number;
  requireImage?: boolean;
}) {
  const sampleSize = Math.max(1, Math.min(100, options?.sampleSize ?? 24));
  const requireImage = options?.requireImage ?? false;

  const take = Math.max(sampleSize * 8, 80);

  const rows: CachedHighlightRow[] = await prisma.dayHighlightCache.findMany({
    where: {
      type: { not: "none" },
      title: { not: null },
      text: { not: "" },
      ...(requireImage
        ? {
            image: {
              not: null,
            },
          }
        : {}),
    },
    select: {
      day: true,
      title: true,
      text: true,
      image: true,
      type: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take,
  });

  const filtered = rows.filter(
    (item: CachedHighlightRow) =>
      !!item.day &&
      !!item.title?.trim() &&
      !!item.text?.trim() &&
      (!requireImage || !!item.image?.trim())
  );

  return shuffleArray(filtered).slice(0, sampleSize) as CachedHighlightSample[];
}

export async function getRandomValidDay(
  options?: RandomValidDayOptions
): Promise<RandomValidDayResult | null> {
  const fresh = options?.fresh ?? false;
  const maxAttempts = options?.maxAttempts ?? 64;
  const maxCacheTake = options?.maxCacheTake ?? 12000;
  const excludeDays = getUniqueDays(options?.excludeDays ?? []);
  const historyState = buildHistoryState(excludeDays);

  if (!fresh) {
    const validDays: CacheDayRow[] = await prisma.dayHighlightCache.findMany({
      where: {
        type: { not: "none" },
        title: { not: null },
        text: { not: "" },
        ...(excludeDays.length > 0
          ? {
              day: {
                notIn: excludeDays,
              },
            }
          : {}),
      },
      select: {
        day: true,
      },
      take: maxCacheTake,
    });

    const cachePool = getUniqueDays(
      validDays.map((item: CacheDayRow) => item.day)
    );
    const pickedFromCache = pickBalancedDay(cachePool, historyState);

    if (pickedFromCache) {
      return {
        day: pickedFromCache,
        source: "cache",
      };
    }
  }

  const tried = new Set<string>(excludeDays);
  const viableGenerated: string[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let candidate = generateCandidateDate(historyState);
    let safety = 0;

    while (tried.has(candidate) && safety < 200) {
      candidate = generateCandidateDate(historyState);
      safety += 1;
    }

    if (tried.has(candidate)) {
      continue;
    }

    tried.add(candidate);

    try {
      const result = await ensureHighlightsForDay(candidate);

      if (isUsableHighlight(result)) {
        viableGenerated.push(candidate);

        if (viableGenerated.length >= 18) {
          break;
        }
      }
    } catch (error) {
      console.error(`[random-valid-day] attempt failed for ${candidate}`, error);
    }
  }

  const pickedGenerated = pickBalancedDay(viableGenerated, historyState);

  if (pickedGenerated) {
    return {
      day: pickedGenerated,
      source: "generated",
    };
  }

  return null;
}