import { prisma } from "@/app/lib/prisma";
import { getOrCreateVisitorId, getVisitorId } from "@/app/lib/visitor-id";

const SURPRISE_ENGINE_VERSION = "v17-realtime-balanced";
const SURPRISE_HISTORY_MAX = 120;
const EXACT_DAY_HARD_COOLDOWN = 72;
const MONTH_HARD_COOLDOWN = 3;
const YEAR_HARD_COOLDOWN = 8;
const DECADE_HARD_COOLDOWN = 5;
const CENTURY_HARD_COOLDOWN = 3;
const MONTH_DAY_HARD_COOLDOWN = 18;
const MIN_EXACT_FILTER_SIZE = 2;
const MIN_BUCKET_CANDIDATES = 1;

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

type BucketOption<T extends string | number> = {
  value: T;
  usage: number;
  isRecent: boolean;
  baseWeight?: number;
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

type SurprisePool = {
  days: string[];
  size: number;
  signature: string;
};

type BucketTarget = {
  century: number | null;
  decade: number | null;
  month: number | null;
  monthDay: string | null;
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

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomUnit() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function pickWeightedOption<T extends string | number>(
  options: BucketOption<T>[],
  config?: {
    usagePower?: number;
    recentPenalty?: number;
  }
): T | null {
  if (options.length === 0) return null;

  const usagePower = config?.usagePower ?? 1.35;
  const recentPenalty = config?.recentPenalty ?? 0.22;

  const weighted = options.map((option) => {
    const usageWeight = 1 / Math.pow(option.usage + 1, usagePower);
    const recencyWeight = option.isRecent ? recentPenalty : 1;
    const baseWeight = option.baseWeight ?? 1;

    return {
      value: option.value,
      weight: Math.max(0.0001, usageWeight * recencyWeight * baseWeight),
    };
  });

  const totalWeight = weighted.reduce(
    (sum: number, option: { value: T; weight: number }) => sum + option.weight,
    0
  );

  if (totalWeight <= 0) {
    return shuffleArray(options)[0]?.value ?? null;
  }

  let roll = randomUnit() * totalWeight;

  for (const option of weighted) {
    roll -= option.weight;

    if (roll <= 0) {
      return option.value;
    }
  }

  return weighted[weighted.length - 1]?.value ?? null;
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

function buildHistoryState(historyDays: string[]): HistoryState {
  const dayUsage = new Map<string, number>();
  const monthUsage = new Map<number, number>();
  const yearUsage = new Map<number, number>();
  const decadeUsage = new Map<number, number>();
  const centuryUsage = new Map<number, number>();
  const monthDayUsage = new Map<string, number>();
  const dayOfMonthUsage = new Map<number, number>();

  const validHistory = historyDays
    .filter(isValidDayString)
    .slice(0, SURPRISE_HISTORY_MAX);

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
    recentExactDays: new Set(validHistory.slice(0, EXACT_DAY_HARD_COOLDOWN)),
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

function uniqueSortedNumbers(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function uniqueSortedStrings(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function filterDays(
  days: string[],
  filters: {
    century?: number | null;
    decade?: number | null;
    month?: number | null;
    monthDay?: string | null;
  }
) {
  return days.filter((day) => {
    const year = parseYear(day);

    if (filters.century !== undefined && filters.century !== null) {
      if (getCentury(year) !== filters.century) return false;
    }

    if (filters.decade !== undefined && filters.decade !== null) {
      if (getDecade(year) !== filters.decade) return false;
    }

    if (filters.month !== undefined && filters.month !== null) {
      if (parseMonth(day) !== filters.month) return false;
    }

    if (filters.monthDay !== undefined && filters.monthDay !== null) {
      if (parseMonthDay(day) !== filters.monthDay) return false;
    }

    return true;
  });
}

function buildBucketOptions<T extends string | number>(
  values: T[],
  usageMap: Map<T, number>,
  recentSet: Set<T>,
  baseWeights?: Map<T, number>
): BucketOption<T>[] {
  return values.map((value) => ({
    value,
    usage: usageMap.get(value) ?? 0,
    isRecent: recentSet.has(value),
    baseWeight: baseWeights?.get(value),
  }));
}

function countValues<T extends string | number>(values: T[]) {
  const counts = new Map<T, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function chooseCentury(poolDays: string[], state: HistoryState) {
  const centuries = uniqueSortedNumbers(
    poolDays.map((day) => getCentury(parseYear(day)))
  );

  return pickWeightedOption(
    buildBucketOptions(centuries, state.centuryUsage, state.recentCenturies),
    { usagePower: 1.25, recentPenalty: 0.45 }
  );
}

function chooseDecade(poolDays: string[], state: HistoryState, century: number | null) {
  const scopedDays = century === null ? poolDays : filterDays(poolDays, { century });
  const decades = uniqueSortedNumbers(
    scopedDays.map((day) => getDecade(parseYear(day)))
  );

  return pickWeightedOption(
    buildBucketOptions(decades, state.decadeUsage, state.recentDecades),
    { usagePower: 1.3, recentPenalty: 0.35 }
  );
}

function chooseMonth(
  poolDays: string[],
  state: HistoryState,
  scope: { century: number | null; decade: number | null }
) {
  const scopedDays = filterDays(poolDays, scope);
  const months = uniqueSortedNumbers(scopedDays.map(parseMonth));
  const monthFrequency = countValues(scopedDays.map(parseMonth));
  const baseWeights = new Map<number, number>();

  for (const month of months) {
    const frequency = monthFrequency.get(month) ?? 1;
    baseWeights.set(month, 1 / Math.sqrt(frequency));
  }

  return pickWeightedOption(
    buildBucketOptions(months, state.monthUsage, state.recentMonths, baseWeights),
    { usagePower: 1.35, recentPenalty: 0.3 }
  );
}

function chooseMonthDay(
  poolDays: string[],
  state: HistoryState,
  scope: { century: number | null; decade: number | null; month: number | null }
) {
  const scopedDays = filterDays(poolDays, scope);
  const monthDays = uniqueSortedStrings(scopedDays.map(parseMonthDay));
  const monthDayFrequency = countValues(scopedDays.map(parseMonthDay));
  const baseWeights = new Map<string, number>();

  for (const monthDay of monthDays) {
    const frequency = monthDayFrequency.get(monthDay) ?? 1;
    baseWeights.set(monthDay, 1 / Math.sqrt(frequency));
  }

  return pickWeightedOption(
    buildBucketOptions(
      monthDays,
      state.monthDayUsage,
      state.recentMonthDays,
      baseWeights
    ),
    { usagePower: 1.55, recentPenalty: 0.12 }
  );
}

function chooseBucketTarget(poolDays: string[], state: HistoryState): BucketTarget {
  const century = chooseCentury(poolDays, state);
  const decade = chooseDecade(poolDays, state, century);
  const month = chooseMonth(poolDays, state, { century, decade });
  const monthDay = chooseMonthDay(poolDays, state, { century, decade, month });

  return {
    century,
    decade,
    month,
    monthDay,
  };
}

function scoreCandidate(day: string, state: HistoryState) {
  const year = parseYear(day);
  const month = parseMonth(day);
  const dayOfMonth = parseDayOfMonth(day);
  const monthDay = parseMonthDay(day);
  const decade = getDecade(year);
  const century = getCentury(year);

  let score =
    (state.dayUsage.get(day) ?? 0) * 1500 +
    (state.monthDayUsage.get(monthDay) ?? 0) * 95 +
    (state.monthUsage.get(month) ?? 0) * 24 +
    (state.dayOfMonthUsage.get(dayOfMonth) ?? 0) * 3 +
    (state.yearUsage.get(year) ?? 0) * 90 +
    (state.decadeUsage.get(decade) ?? 0) * 34 +
    (state.centuryUsage.get(century) ?? 0) * 18;

  if (state.recentExactDays.has(day)) score += 10000;
  if (state.recentMonthDays.has(monthDay)) score += 900;
  if (state.recentYears.has(year)) score += 380;
  if (state.recentDecades.has(decade)) score += 130;
  if (state.recentCenturies.has(century)) score += 40;
  if (state.recentMonths.has(month)) score += 85;

  return score;
}

function applyExactCooldown(days: string[], state: HistoryState) {
  const withoutRecentExact = days.filter((day) => !state.recentExactDays.has(day));

  if (withoutRecentExact.length >= MIN_EXACT_FILTER_SIZE) {
    return withoutRecentExact;
  }

  return days;
}

function buildCandidateSet(
  poolDays: string[],
  state: HistoryState,
  target: BucketTarget
) {
  const attempts = [
    filterDays(poolDays, {
      century: target.century,
      decade: target.decade,
      month: target.month,
      monthDay: target.monthDay,
    }),
    filterDays(poolDays, {
      century: target.century,
      decade: target.decade,
      monthDay: target.monthDay,
    }),
    filterDays(poolDays, {
      monthDay: target.monthDay,
    }),
    filterDays(poolDays, {
      century: target.century,
      decade: target.decade,
      month: target.month,
    }),
    filterDays(poolDays, {
      century: target.century,
      decade: target.decade,
    }),
    filterDays(poolDays, {
      century: target.century,
    }),
    poolDays,
  ];

  for (const attempt of attempts) {
    const unique = uniqueSortedStrings(attempt);

    if (unique.length >= MIN_BUCKET_CANDIDATES) {
      return applyExactCooldown(unique, state);
    }
  }

  return [];
}

function pickRealtimeBalancedDay(poolDays: string[], historyDays: string[]) {
  const uniqueDays = uniqueSortedStrings(poolDays.filter(isValidDayString));

  if (uniqueDays.length === 0) return null;
  if (uniqueDays.length === 1) return uniqueDays[0];

  const state = buildHistoryState(historyDays);
  const target = chooseBucketTarget(uniqueDays, state);
  const candidates = buildCandidateSet(uniqueDays, state, target);
  const safeCandidates = candidates.length > 0 ? candidates : uniqueDays;

  const scored = safeCandidates.map((day) => ({
    day,
    score: scoreCandidate(day, state) + randomUnit() * 140,
  }));

  scored.sort((a, b) => a.score - b.score);

  const bestScore = scored[0]?.score ?? 0;
  const softWindow = scored.filter((item) => item.score <= bestScore + 180);
  const choicePool = softWindow.slice(0, Math.min(36, softWindow.length || 1));

  const weightedChoices = choicePool.map((item) => ({
    value: item.day,
    weight: 1 / Math.pow(Math.max(1, item.score - bestScore + 1), 1.18),
  }));

  const totalWeight = weightedChoices.reduce(
    (sum: number, item: { value: string; weight: number }) => sum + item.weight,
    0
  );

  let roll = randomUnit() * totalWeight;

  for (const item of weightedChoices) {
    roll -= item.weight;

    if (roll <= 0) {
      return item.value;
    }
  }

  return choicePool[choicePool.length - 1]?.day ?? scored[0]?.day ?? null;
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

  const days = uniqueSortedStrings(
    rows
      .map((row: CacheDayRow) => row.day)
      .filter((day): day is string => isValidDayString(day))
  );

  const lastUpdatedAt = rows.reduce((max: number, row: CacheDayRow) => {
    const time = row.updatedAt.getTime();
    return time > max ? time : max;
  }, 0);

  return {
    days,
    size: days.length,
    signature: `${SURPRISE_ENGINE_VERSION}:${days.length}:${lastUpdatedAt}`,
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

  const row: SurpriseDeckRow | null = await prisma.surpriseDeck.findUnique({
    where: { ownerKey },
  });

  const poolSet = new Set(pool.days);
  const recentHistory = getRecentHistory(row, poolSet);
  const day = pickRealtimeBalancedDay(pool.days, recentHistory);

  if (!isValidDayString(day)) {
    return null;
  }

  const nextHistory = [day, ...recentHistory.filter((item) => item !== day)].slice(
    0,
    SURPRISE_HISTORY_MAX
  );

  await upsertState({
    ownerKey,
    userId,
    recentHistory: nextHistory,
    poolSize: pool.size,
    poolSignature: pool.signature,
  });

  return {
    day,
    source: "realtime-balanced" as const,
    remaining: Math.max(0, pool.days.length - new Set(nextHistory).size),
    total: pool.size,
  };
}