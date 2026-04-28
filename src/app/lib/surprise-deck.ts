import { prisma } from "@/app/lib/prisma";
import { getOrCreateVisitorId, getVisitorId } from "@/app/lib/visitor-id";

const SURPRISE_ENGINE_VERSION = "v21-effective-pool-capped-low-views";
const SURPRISE_HISTORY_MAX = 360;
const GLOBAL_OWNER_KEY = "global:surprise-recent";
const GLOBAL_HISTORY_MAX = 240;

const EXACT_DAY_COOLDOWN_MIN = 48;
const EXACT_DAY_COOLDOWN_MAX = 120;
const EXACT_DAY_COOLDOWN_POOL_RATIO = 0.45;
const MONTH_DAY_HARD_COOLDOWN = 48;
const MONTH_HARD_COOLDOWN = 5;
const YEAR_HARD_COOLDOWN = 10;
const DECADE_HARD_COOLDOWN = 7;
const CENTURY_HARD_COOLDOWN = 4;
const MIN_CANDIDATE_DAYS = 10;
const MIN_DISTINCT_MONTHS = 4;
const MIN_DISTINCT_MONTH_DAYS = 8;
const FINAL_EXACT_DAY_POOL_MAX = 36;

const EFFECTIVE_POOL_MIN_SIZE = 120;
const DEFAULT_MONTH_DAY_CAP = 5;
const APRIL_MONTH_DAY_CAP = 3;
const APRIL_HOT_MONTH_DAY_CAP = 2;
const MONTH_CAP_MIN = 24;
const MONTH_CAP_MAX = 90;
const MONTH_CAP_FACTOR = 1.15;
const APRIL_MONTH_CAP_FACTOR = 0.7;

type OwnerKind = "user" | "visitor";

type DeckRowLike = {
  deck: unknown;
  cursor: number | null;
};

type SurpriseDeckRow = {
  ownerKey: string;
  userId: string | null;
  deck: unknown;
  cursor: number;
  poolSize: number;
  poolSignature: string;
};

type CacheDayRow = {
  day: string;
  updatedAt: Date;
};

type DayStatsRow = {
  day: string;
  views: number;
};

type EffectiveCandidate = {
  day: string;
  updatedAt: Date;
  views: number;
};

type SurprisePool = {
  days: string[];
  size: number;
  signature: string;
  monthFrequency: Map<number, number>;
  monthDayFrequency: Map<string, number>;
};

type HistoryState = {
  dayUsage: Map<string, number>;
  monthUsage: Map<number, number>;
  yearUsage: Map<number, number>;
  decadeUsage: Map<number, number>;
  centuryUsage: Map<number, number>;
  monthDayUsage: Map<string, number>;
  dayOfMonthUsage: Map<number, number>;
  recentExactDays: Set<string>;
  recentMonths: Set<number>;
  recentYears: Set<number>;
  recentDecades: Set<number>;
  recentCenturies: Set<number>;
  recentMonthDays: Set<string>;
};

type WeightedValue<T> = {
  value: T;
  weight: number;
};

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function getCentury(year: number) {
  return Math.floor(year / 100) * 100;
}

function randomUnit() {
  return Math.random();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stableHash(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomUnit() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function pickWeightedValue<T>(items: WeightedValue<T>[]): T | null {
  if (items.length === 0) return null;

  const totalWeight = items.reduce(
    (sum: number, item: WeightedValue<T>) => sum + Math.max(0, item.weight),
    0
  );

  if (totalWeight <= 0) {
    return shuffleArray(items)[0]?.value ?? null;
  }

  let roll = randomUnit() * totalWeight;

  for (const item of items) {
    roll -= Math.max(0, item.weight);

    if (roll <= 0) {
      return item.value;
    }
  }

  return items[items.length - 1]?.value ?? null;
}

function normalizeStoredDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && isValidDayString(item)
      )
    )
  );
}

function incrementMapCount<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function countValues<T extends string | number>(values: T[]) {
  const counts = new Map<T, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function uniqueSortedNumbers(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function uniqueSortedStrings(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function countDistinctMonths(days: string[]) {
  return new Set(days.map(parseMonth)).size;
}

function countDistinctMonthDays(days: string[]) {
  return new Set(days.map(parseMonthDay)).size;
}

function getExactDayCooldown(poolSize: number) {
  if (poolSize <= 1) return 0;

  return clamp(
    Math.floor(poolSize * EXACT_DAY_COOLDOWN_POOL_RATIO),
    EXACT_DAY_COOLDOWN_MIN,
    EXACT_DAY_COOLDOWN_MAX
  );
}

function buildHistoryState(historyDays: string[], poolSize: number): HistoryState {
  const dayUsage = new Map<string, number>();
  const monthUsage = new Map<number, number>();
  const yearUsage = new Map<number, number>();
  const decadeUsage = new Map<number, number>();
  const centuryUsage = new Map<number, number>();
  const monthDayUsage = new Map<string, number>();
  const dayOfMonthUsage = new Map<number, number>();

  const validHistory = historyDays
    .filter(isValidDayString)
    .slice(0, SURPRISE_HISTORY_MAX + GLOBAL_HISTORY_MAX);

  for (const day of validHistory) {
    const year = parseYear(day);
    const month = parseMonth(day);
    const decade = getDecade(year);
    const century = getCentury(year);
    const monthDay = parseMonthDay(day);
    const dayOfMonth = parseDayOfMonth(day);

    incrementMapCount(dayUsage, day);
    incrementMapCount(monthUsage, month);
    incrementMapCount(yearUsage, year);
    incrementMapCount(decadeUsage, decade);
    incrementMapCount(centuryUsage, century);
    incrementMapCount(monthDayUsage, monthDay);
    incrementMapCount(dayOfMonthUsage, dayOfMonth);
  }

  return {
    dayUsage,
    monthUsage,
    yearUsage,
    decadeUsage,
    centuryUsage,
    monthDayUsage,
    dayOfMonthUsage,
    recentExactDays: new Set(validHistory.slice(0, getExactDayCooldown(poolSize))),
    recentMonths: new Set(validHistory.map(parseMonth).slice(0, MONTH_HARD_COOLDOWN)),
    recentYears: new Set(validHistory.map(parseYear).slice(0, YEAR_HARD_COOLDOWN)),
    recentDecades: new Set(
      validHistory
        .map((day) => getDecade(parseYear(day)))
        .slice(0, DECADE_HARD_COOLDOWN)
    ),
    recentCenturies: new Set(
      validHistory
        .map((day) => getCentury(parseYear(day)))
        .slice(0, CENTURY_HARD_COOLDOWN)
    ),
    recentMonthDays: new Set(
      validHistory.map(parseMonthDay).slice(0, MONTH_DAY_HARD_COOLDOWN)
    ),
  };
}

function getRecentHistory(row?: DeckRowLike | null, poolSet?: Set<string>) {
  const history = normalizeStoredDays(row?.deck).slice(0, SURPRISE_HISTORY_MAX);

  if (!poolSet) {
    return history;
  }

  return history.filter((day) => poolSet.has(day));
}

function getGlobalRecentHistory(row?: DeckRowLike | null, poolSet?: Set<string>) {
  const history = normalizeStoredDays(row?.deck).slice(0, GLOBAL_HISTORY_MAX);

  if (!poolSet) {
    return history;
  }

  return history.filter((day) => poolSet.has(day));
}

function buildSelectionHistory(ownerHistory: string[], globalHistory: string[]) {
  return [
    ...ownerHistory.slice(0, 80),
    ...globalHistory.slice(0, 180),
    ...ownerHistory.slice(80),
    ...globalHistory.slice(180),
  ];
}

function mergeHistories(
  primary: string[],
  secondary: string[],
  poolSet: Set<string>
) {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const day of [...primary, ...secondary]) {
    if (!poolSet.has(day) || seen.has(day) || !isValidDayString(day)) continue;

    merged.push(day);
    seen.add(day);

    if (merged.length >= SURPRISE_HISTORY_MAX) {
      break;
    }
  }

  return merged;
}

function filterDays(
  days: string[],
  filters: {
    month?: number | null;
    monthDay?: string | null;
    year?: number | null;
    decade?: number | null;
    century?: number | null;
  }
) {
  return days.filter((day) => {
    const year = parseYear(day);

    if (filters.month !== undefined && filters.month !== null) {
      if (parseMonth(day) !== filters.month) return false;
    }

    if (filters.monthDay !== undefined && filters.monthDay !== null) {
      if (parseMonthDay(day) !== filters.monthDay) return false;
    }

    if (filters.year !== undefined && filters.year !== null) {
      if (year !== filters.year) return false;
    }

    if (filters.decade !== undefined && filters.decade !== null) {
      if (getDecade(year) !== filters.decade) return false;
    }

    if (filters.century !== undefined && filters.century !== null) {
      if (getCentury(year) !== filters.century) return false;
    }

    return true;
  });
}

function preferWithoutRecentExact(days: string[], state: HistoryState) {
  const filtered = days.filter((day) => !state.recentExactDays.has(day));

  if (filtered.length >= MIN_CANDIDATE_DAYS) {
    return filtered;
  }

  return days;
}

function preferWithoutRecentMonthDays(days: string[], state: HistoryState) {
  const filtered = days.filter((day) => !state.recentMonthDays.has(parseMonthDay(day)));

  if (
    filtered.length >= MIN_CANDIDATE_DAYS &&
    countDistinctMonthDays(filtered) >= Math.min(MIN_DISTINCT_MONTH_DAYS, filtered.length)
  ) {
    return filtered;
  }

  return days;
}

function preferWithoutRecentMonths(days: string[], state: HistoryState) {
  const filtered = days.filter((day) => !state.recentMonths.has(parseMonth(day)));

  if (
    filtered.length >= MIN_CANDIDATE_DAYS &&
    countDistinctMonths(filtered) >= MIN_DISTINCT_MONTHS
  ) {
    return filtered;
  }

  return days;
}

function buildSelectionPool(days: string[], state: HistoryState) {
  const withoutRecentExact = preferWithoutRecentExact(days, state);
  const withoutRecentMonthDays = preferWithoutRecentMonthDays(withoutRecentExact, state);

  return preferWithoutRecentMonths(withoutRecentMonthDays, state);
}

function buildMonthOptions(
  days: string[],
  state: HistoryState,
  monthFrequency: Map<number, number>
): WeightedValue<number>[] {
  const months = uniqueSortedNumbers(days.map(parseMonth));

  return months.map((month) => {
    const usage = state.monthUsage.get(month) ?? 0;
    const poolCount = monthFrequency.get(month) ?? 1;
    const localCount = days.filter((day) => parseMonth(day) === month).length;

    const usageWeight = 1 / Math.pow(usage + 1, 2.15);
    const recentWeight = state.recentMonths.has(month) ? 0.12 : 1;
    const poolDominanceWeight = 1 / Math.pow(Math.max(1, poolCount), 0.32);
    const localAvailabilityWeight = Math.pow(Math.max(1, localCount), 0.18);

    return {
      value: month,
      weight: Math.max(
        0.000001,
        usageWeight * recentWeight * poolDominanceWeight * localAvailabilityWeight
      ),
    };
  });
}

function buildMonthDayOptions(
  days: string[],
  state: HistoryState,
  monthDayFrequency: Map<string, number>
): WeightedValue<string>[] {
  const monthDays = uniqueSortedStrings(days.map(parseMonthDay));

  return monthDays.map((monthDay) => {
    const usage = state.monthDayUsage.get(monthDay) ?? 0;
    const poolCount = monthDayFrequency.get(monthDay) ?? 1;
    const localCount = days.filter((day) => parseMonthDay(day) === monthDay).length;

    const usageWeight = 1 / Math.pow(usage + 1, 2.85);
    const recentWeight = state.recentMonthDays.has(monthDay) ? 0.01 : 1;
    const poolDominanceWeight = 1 / Math.pow(Math.max(1, poolCount), 1.35);
    const localAvailabilityWeight = Math.pow(Math.max(1, localCount), 0.08);

    return {
      value: monthDay,
      weight: Math.max(
        0.000001,
        usageWeight * recentWeight * poolDominanceWeight * localAvailabilityWeight
      ),
    };
  });
}

function scoreExactDay(day: string, state: HistoryState) {
  const year = parseYear(day);
  const dayOfMonth = parseDayOfMonth(day);
  const decade = getDecade(year);
  const century = getCentury(year);

  let score =
    (state.dayUsage.get(day) ?? 0) * 10000 +
    (state.yearUsage.get(year) ?? 0) * 95 +
    (state.decadeUsage.get(decade) ?? 0) * 36 +
    (state.centuryUsage.get(century) ?? 0) * 20 +
    (state.dayOfMonthUsage.get(dayOfMonth) ?? 0) * 3;

  if (state.recentExactDays.has(day)) score += 50000;
  if (state.recentYears.has(year)) score += 420;
  if (state.recentDecades.has(decade)) score += 140;
  if (state.recentCenturies.has(century)) score += 45;

  return score + randomUnit() * 75;
}

function pickExactDay(days: string[], state: HistoryState) {
  if (days.length === 0) return null;
  if (days.length === 1) return days[0];

  const scored = days.map((day) => ({
    day,
    score: scoreExactDay(day, state),
  }));

  scored.sort((a, b) => a.score - b.score || a.day.localeCompare(b.day));

  const bestScore = scored[0]?.score ?? 0;
  const window = scored
    .filter((item) => item.score <= bestScore + 380)
    .slice(0, FINAL_EXACT_DAY_POOL_MAX);
  const windowBestScore = window[0]?.score ?? bestScore;

  return pickWeightedValue(
    window.map((item) => ({
      value: item.day,
      weight: 1 / Math.pow(Math.max(1, item.score - windowBestScore + 1), 1.2),
    }))
  );
}

function pickRealtimeBalancedDay(pool: SurprisePool, historyDays: string[]) {
  const uniqueDays = uniqueSortedStrings(pool.days.filter(isValidDayString));

  if (uniqueDays.length === 0) return null;
  if (uniqueDays.length === 1) return uniqueDays[0];

  const state = buildHistoryState(historyDays, uniqueDays.length);
  const selectionPool = buildSelectionPool(uniqueDays, state);
  const safeSelectionPool = selectionPool.length > 0 ? selectionPool : uniqueDays;

  const selectedMonth = pickWeightedValue(
    buildMonthOptions(safeSelectionPool, state, pool.monthFrequency)
  );

  const monthScopedDays = selectedMonth
    ? filterDays(safeSelectionPool, { month: selectedMonth })
    : safeSelectionPool;
  const safeMonthScopedDays =
    monthScopedDays.length > 0 ? monthScopedDays : safeSelectionPool;

  const selectedMonthDay = pickWeightedValue(
    buildMonthDayOptions(safeMonthScopedDays, state, pool.monthDayFrequency)
  );

  const monthDayScopedDays = selectedMonthDay
    ? filterDays(safeMonthScopedDays, { monthDay: selectedMonthDay })
    : safeMonthScopedDays;
  const safeMonthDayScopedDays =
    monthDayScopedDays.length > 0 ? monthDayScopedDays : safeMonthScopedDays;

  const day = pickExactDay(safeMonthDayScopedDays, state);

  if (isValidDayString(day)) {
    return day;
  }

  return pickExactDay(safeSelectionPool, state);
}

function buildMonthFrequency(days: string[]) {
  return countValues(days.map(parseMonth));
}

function buildMonthDayFrequency(days: string[]) {
  return countValues(days.map(parseMonthDay));
}

function getMonthDayCap(monthDay: string) {
  if (monthDay === "04-27" || monthDay === "04-28" || monthDay === "04-29") {
    return APRIL_HOT_MONTH_DAY_CAP;
  }

  if (monthDay.startsWith("04-")) {
    return APRIL_MONTH_DAY_CAP;
  }

  return DEFAULT_MONTH_DAY_CAP;
}

function getMonthCap(month: number, rawTotal: number) {
  const base = clamp(
    Math.ceil((rawTotal / 12) * MONTH_CAP_FACTOR),
    MONTH_CAP_MIN,
    MONTH_CAP_MAX
  );

  if (month === 4) {
    return clamp(Math.floor(base * APRIL_MONTH_CAP_FACTOR), 18, base);
  }

  return base;
}

function rankEffectiveCandidate(candidate: EffectiveCandidate) {
  const year = parseYear(candidate.day);
  const decade = getDecade(year);
  const century = getCentury(year);

  return (
    candidate.views * 1000 +
    Math.max(0, 2026 - year) * 0.35 +
    Math.abs(decade - 1950) * 0.05 +
    Math.abs(century - 1900) * 0.02 +
    stableHash(candidate.day) / 1_000_000
  );
}

function selectDiverseCandidates(candidates: EffectiveCandidate[], max: number) {
  if (candidates.length <= max) return [...candidates];

  const remaining = [...candidates];
  const selected: EffectiveCandidate[] = [];
  const decadeUsage = new Map<number, number>();
  const centuryUsage = new Map<number, number>();

  while (remaining.length > 0 && selected.length < max) {
    remaining.sort((a, b) => {
      const aYear = parseYear(a.day);
      const bYear = parseYear(b.day);

      const aDecade = getDecade(aYear);
      const bDecade = getDecade(bYear);

      const aCentury = getCentury(aYear);
      const bCentury = getCentury(bYear);

      const aScore =
        rankEffectiveCandidate(a) +
        (decadeUsage.get(aDecade) ?? 0) * 160 +
        (centuryUsage.get(aCentury) ?? 0) * 55;

      const bScore =
        rankEffectiveCandidate(b) +
        (decadeUsage.get(bDecade) ?? 0) * 160 +
        (centuryUsage.get(bCentury) ?? 0) * 55;

      return aScore - bScore || a.day.localeCompare(b.day);
    });

    const picked = remaining.shift();

    if (!picked) break;

    selected.push(picked);

    const pickedYear = parseYear(picked.day);
    incrementMapCount(decadeUsage, getDecade(pickedYear));
    incrementMapCount(centuryUsage, getCentury(pickedYear));
  }

  return selected;
}

function buildEffectiveSurpriseDays(
  rawRows: CacheDayRow[],
  viewsByDay: Map<string, number>
) {
  const uniqueRowsByDay = new Map<string, EffectiveCandidate>();

  for (const row of rawRows) {
    if (!isValidDayString(row.day)) continue;

    uniqueRowsByDay.set(row.day, {
      day: row.day,
      updatedAt: row.updatedAt,
      views: viewsByDay.get(row.day) ?? 0,
    });
  }

  const rawCandidates = Array.from(uniqueRowsByDay.values());
  const byMonthDay = new Map<string, EffectiveCandidate[]>();

  for (const candidate of rawCandidates) {
    const monthDay = parseMonthDay(candidate.day);
    const group = byMonthDay.get(monthDay) ?? [];
    group.push(candidate);
    byMonthDay.set(monthDay, group);
  }

  const cappedMonthDayCandidates: EffectiveCandidate[] = [];

  for (const [monthDay, group] of byMonthDay.entries()) {
    const cap = getMonthDayCap(monthDay);
    cappedMonthDayCandidates.push(...selectDiverseCandidates(group, cap));
  }

  const byMonth = new Map<number, EffectiveCandidate[]>();

  for (const candidate of cappedMonthDayCandidates) {
    const month = parseMonth(candidate.day);
    const group = byMonth.get(month) ?? [];
    group.push(candidate);
    byMonth.set(month, group);
  }

  const effective = new Map<string, EffectiveCandidate>();

  for (let month = 1; month <= 12; month += 1) {
    const group = byMonth.get(month) ?? [];
    const cap = getMonthCap(month, rawCandidates.length);
    const selected = selectDiverseCandidates(group, cap);

    for (const candidate of selected) {
      effective.set(candidate.day, candidate);
    }
  }

  if (effective.size < Math.min(EFFECTIVE_POOL_MIN_SIZE, rawCandidates.length)) {
    const fallbackCandidates = selectDiverseCandidates(
      rawCandidates.filter((candidate) => !effective.has(candidate.day)),
      Math.min(EFFECTIVE_POOL_MIN_SIZE, rawCandidates.length) - effective.size
    );

    for (const candidate of fallbackCandidates) {
      effective.set(candidate.day, candidate);
    }
  }

  return uniqueSortedStrings(Array.from(effective.keys()));
}

async function getSurprisePool(): Promise<SurprisePool> {
  const rows: CacheDayRow[] = await prisma.dayHighlightCache.findMany({
    where: {
      type: { not: "none" },
      title: { not: null },
      text: { not: "" },
    },
    select: {
      day: true,
      updatedAt: true,
    },
  });

  const rawDays = uniqueSortedStrings(
    rows
      .map((row: CacheDayRow) => row.day)
      .filter((day): day is string => isValidDayString(day))
  );

  const statsRows: DayStatsRow[] =
    rawDays.length > 0
      ? await prisma.dayStats.findMany({
          where: {
            day: {
              in: rawDays,
            },
          },
          select: {
            day: true,
            views: true,
          },
        })
      : [];

  const viewsByDay = new Map(
    statsRows.map((row: DayStatsRow) => [row.day, row.views])
  );

  const days = buildEffectiveSurpriseDays(rows, viewsByDay);

  const lastUpdatedAt = rows.reduce((max: number, row: CacheDayRow) => {
    const time = row.updatedAt.getTime();
    return time > max ? time : max;
  }, 0);

  return {
    days,
    size: days.length,
    signature: `${SURPRISE_ENGINE_VERSION}:raw-${rawDays.length}:effective-${days.length}:${lastUpdatedAt}`,
    monthFrequency: buildMonthFrequency(days),
    monthDayFrequency: buildMonthDayFrequency(days),
  };
}

async function upsertState(args: {
  ownerKey: string;
  userId?: string | null;
  recentHistory: string[];
  poolSize: number;
  poolSignature: string;
}) {
  const { ownerKey, userId, recentHistory, poolSize, poolSignature } = args;

  return prisma.surpriseDeck.upsert({
    where: { ownerKey },
    update: {
      userId: userId ?? null,
      deck: recentHistory,
      cursor: 0,
      poolSize,
      poolSignature,
    },
    create: {
      ownerKey,
      userId: userId ?? null,
      deck: recentHistory,
      cursor: 0,
      poolSize,
      poolSignature,
    },
  });
}

function buildOwnerKey(kind: OwnerKind, id: string) {
  return `${kind}:${id}`;
}

export async function claimVisitorDeckToUser(userId: string) {
  const visitorId = await getVisitorId();

  if (!visitorId) return;

  const visitorOwnerKey = buildOwnerKey("visitor", visitorId);
  const userOwnerKey = buildOwnerKey("user", userId);

  if (visitorOwnerKey === userOwnerKey) return;

  const pool = await getSurprisePool();

  if (pool.days.length === 0) return;

  const poolSet = new Set(pool.days);

  const [visitorDeck, userDeck]: [SurpriseDeckRow | null, SurpriseDeckRow | null] =
    await Promise.all([
      prisma.surpriseDeck.findUnique({
        where: { ownerKey: visitorOwnerKey },
      }),
      prisma.surpriseDeck.findUnique({
        where: { ownerKey: userOwnerKey },
      }),
    ]);

  if (!visitorDeck) return;

  const mergedHistory = mergeHistories(
    getRecentHistory(visitorDeck, poolSet),
    getRecentHistory(userDeck, poolSet),
    poolSet
  );

  await prisma.$transaction([
    prisma.surpriseDeck.upsert({
      where: { ownerKey: userOwnerKey },
      update: {
        userId,
        deck: mergedHistory,
        cursor: 0,
        poolSize: pool.size,
        poolSignature: pool.signature,
      },
      create: {
        ownerKey: userOwnerKey,
        userId,
        deck: mergedHistory,
        cursor: 0,
        poolSize: pool.size,
        poolSignature: pool.signature,
      },
    }),
    prisma.surpriseDeck.deleteMany({
      where: { ownerKey: visitorOwnerKey },
    }),
  ]);
}

export async function getNextSurpriseDay(options?: { userId?: string | null }) {
  const userId = options?.userId ?? null;
  const visitorId = await getOrCreateVisitorId();

  if (userId) {
    await claimVisitorDeckToUser(userId);
  }

  const pool = await getSurprisePool();

  if (pool.days.length === 0) {
    return null;
  }

  const ownerKey = userId
    ? buildOwnerKey("user", userId)
    : buildOwnerKey("visitor", visitorId);

  const poolSet = new Set(pool.days);

  const [ownerRow, globalRow]: [SurpriseDeckRow | null, SurpriseDeckRow | null] =
    await Promise.all([
      prisma.surpriseDeck.findUnique({
        where: { ownerKey },
      }),
      prisma.surpriseDeck.findUnique({
        where: { ownerKey: GLOBAL_OWNER_KEY },
      }),
    ]);

  const ownerHistory = getRecentHistory(ownerRow, poolSet);
  const globalHistory = getGlobalRecentHistory(globalRow, poolSet);
  const selectionHistory = buildSelectionHistory(ownerHistory, globalHistory);
  const day = pickRealtimeBalancedDay(pool, selectionHistory);

  if (!isValidDayString(day)) {
    return null;
  }

  const nextOwnerHistory = [
    day,
    ...ownerHistory.filter((item) => item !== day),
  ].slice(0, SURPRISE_HISTORY_MAX);

  const nextGlobalHistory = [
    day,
    ...globalHistory.filter((item) => item !== day),
  ].slice(0, GLOBAL_HISTORY_MAX);

  await prisma.$transaction([
    prisma.surpriseDeck.upsert({
      where: { ownerKey },
      update: {
        userId,
        deck: nextOwnerHistory,
        cursor: 0,
        poolSize: pool.size,
        poolSignature: pool.signature,
      },
      create: {
        ownerKey,
        userId,
        deck: nextOwnerHistory,
        cursor: 0,
        poolSize: pool.size,
        poolSignature: pool.signature,
      },
    }),
    prisma.surpriseDeck.upsert({
      where: { ownerKey: GLOBAL_OWNER_KEY },
      update: {
        userId: null,
        deck: nextGlobalHistory,
        cursor: 0,
        poolSize: pool.size,
        poolSignature: pool.signature,
      },
      create: {
        ownerKey: GLOBAL_OWNER_KEY,
        userId: null,
        deck: nextGlobalHistory,
        cursor: 0,
        poolSize: pool.size,
        poolSignature: pool.signature,
      },
    }),
  ]);

  return {
    day,
    source: "realtime-balanced" as const,
    remaining: Math.max(0, pool.days.length - new Set(nextOwnerHistory).size),
    total: pool.size,
  };
}

export async function simulateSurpriseDays(count: number) {
  const pool = await getSurprisePool();
  const days: string[] = [];
  let history: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const day = pickRealtimeBalancedDay(pool, history);

    if (!isValidDayString(day)) {
      break;
    }

    days.push(day);
    history = [day, ...history.filter((item) => item !== day)].slice(
      0,
      SURPRISE_HISTORY_MAX
    );
  }

  return {
    days,
    total: pool.size,
    poolSignature: pool.signature,
  };
}