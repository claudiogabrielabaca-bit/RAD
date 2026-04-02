import { prisma } from "@/app/lib/prisma";
import { getOrCreateVisitorId, getVisitorId } from "@/app/lib/visitor-id";

const SURPRISE_DECK_VERSION = "v10-month-cycle-year-balanced";
const MONTH_COOLDOWN = 4;
const YEAR_COOLDOWN = 6;
const DECADE_COOLDOWN = 4;
const MONTH_DAY_COOLDOWN = 12;

type DeckRowLike = {
  deck: unknown;
  cursor: number;
};

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

function getEraBucket(day: string): EraBucket {
  const year = parseYear(day);

  if (year >= 1800 && year <= 1899) return "nineteenth";
  if (year >= 2000) return "twentyFirst";
  return "twentieth";
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function normalizeStoredDeck(value: unknown) {
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

function getSeenDays(row?: DeckRowLike | null) {
  if (!row) return [];

  const deck = normalizeStoredDeck(row.deck);
  const safeCursor = Math.max(0, Math.min(row.cursor ?? 0, deck.length));

  return deck.slice(0, safeCursor);
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

  const validHistory = historyDays.filter(isValidDayString);

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

function updateHistoryState(state: HistoryState, day: string) {
  const year = parseYear(day);
  const month = parseMonth(day);
  const decade = getDecade(year);
  const era = getEraBucket(day);
  const monthDay = parseMonthDay(day);
  const dayOfMonth = parseDayOfMonth(day);

  incrementMapCount(state.monthUsage, month);
  incrementMapCount(state.yearUsage, year);
  incrementMapCount(state.decadeUsage, decade);
  incrementMapCount(state.eraUsage, era);
  incrementMapCount(state.monthDayUsage, monthDay);
  incrementMapCount(state.dayOfMonthUsage, dayOfMonth);

  state.recentMonths.push(month);
  if (state.recentMonths.length > MONTH_COOLDOWN) state.recentMonths.shift();

  state.recentYears.push(year);
  if (state.recentYears.length > YEAR_COOLDOWN) state.recentYears.shift();

  state.recentDecades.push(decade);
  if (state.recentDecades.length > DECADE_COOLDOWN) state.recentDecades.shift();

  state.recentMonthDays.push(monthDay);
  if (state.recentMonthDays.length > MONTH_DAY_COOLDOWN) {
    state.recentMonthDays.shift();
  }
}

function getMonthPriorityOrder(
  buckets: Map<number, string[]>,
  state: HistoryState
) {
  const availableMonths = [...buckets.entries()]
    .filter(([, days]) => days.length > 0)
    .map(([month]) => month);

  if (availableMonths.length === 0) return [];

  const nonRecentMonths = availableMonths.filter(
    (month) => !state.recentMonths.includes(month)
  );
  const candidateMonths =
    nonRecentMonths.length > 0 ? nonRecentMonths : availableMonths;

  const ranked = candidateMonths.map((month) => {
    const days = buckets.get(month) ?? [];
    const usage = state.monthUsage.get(month) ?? 0;
    const yearSpread = new Set(days.map((day) => parseYear(day))).size;
    const decadeSpread = new Set(
      days.map((day) => getDecade(parseYear(day)))
    ).size;

    return {
      month,
      usage,
      yearSpread,
      decadeSpread,
      count: days.length,
    };
  });

  ranked.sort((a, b) => {
    if (a.usage !== b.usage) return a.usage - b.usage;
    if (a.yearSpread !== b.yearSpread) return b.yearSpread - a.yearSpread;
    if (a.decadeSpread !== b.decadeSpread) return b.decadeSpread - a.decadeSpread;
    if (a.count !== b.count) return b.count - a.count;
    return a.month - b.month;
  });

  const bestUsage = ranked[0]?.usage ?? 0;
  const best = ranked.filter((item) => item.usage === bestUsage);

  return shuffleArray(best.map((item) => item.month));
}

function scoreCandidate(day: string, state: HistoryState) {
  const year = parseYear(day);
  const decade = getDecade(year);
  const era = getEraBucket(day);
  const monthDay = parseMonthDay(day);
  const dayOfMonth = parseDayOfMonth(day);

  let score =
    (state.yearUsage.get(year) ?? 0) * 14 +
    (state.decadeUsage.get(decade) ?? 0) * 5.5 +
    (state.eraUsage.get(era) ?? 0) * 1.2 +
    (state.monthDayUsage.get(monthDay) ?? 0) * 18 +
    (state.dayOfMonthUsage.get(dayOfMonth) ?? 0) * 0.5;

  if (state.recentYears.includes(year)) score += 120;
  if (state.recentDecades.includes(decade)) score += 36;
  if (state.recentMonthDays.includes(monthDay)) score += 220;

  return score;
}

function pickBestCandidate(days: string[], state: HistoryState) {
  if (days.length === 0) return null;

  const scored = days.map((day) => ({
    day,
    score: scoreCandidate(day, state),
  }));

  scored.sort((a, b) => a.score - b.score);

  const bestScore = scored[0]?.score ?? 0;
  const nearBest = scored.filter((item) => item.score <= bestScore + 3);
  const choicePool = nearBest.slice(0, 10);

  return shuffleArray(choicePool)[0]?.day ?? scored[0]?.day ?? null;
}

function buildBalancedDeck(days: string[], historyDays: string[] = []) {
  const uniqueDays = Array.from(
    new Set(days.filter((day): day is string => isValidDayString(day)))
  );

  const buckets = new Map<number, string[]>();
  for (const day of shuffleArray(uniqueDays)) {
    const month = parseMonth(day);
    const current = buckets.get(month) ?? [];
    current.push(day);
    buckets.set(month, current);
  }

  const state = buildHistoryState(historyDays);
  const result: string[] = [];

  while (true) {
    const monthOrder = getMonthPriorityOrder(buckets, state);

    if (monthOrder.length === 0) {
      break;
    }

    for (const month of monthOrder) {
      const bucket = buckets.get(month) ?? [];
      const selected = pickBestCandidate(bucket, state);

      if (!selected) {
        continue;
      }

      const nextBucket = bucket.filter((day) => day !== selected);
      buckets.set(month, nextBucket);

      result.push(selected);
      updateHistoryState(state, selected);
    }
  }

  return result;
}

function buildFreshDeck(poolDays: string[]) {
  return {
    deck: buildBalancedDeck(poolDays),
    cursor: 0,
  };
}

function buildDeckFromSeenDays(poolDays: string[], seenDays: string[]) {
  const poolSet = new Set(poolDays);
  const uniqueSeen: string[] = [];
  const seenSet = new Set<string>();

  for (const day of seenDays) {
    if (!poolSet.has(day) || seenSet.has(day)) continue;
    uniqueSeen.push(day);
    seenSet.add(day);
  }

  const remainingPool = poolDays.filter((day) => !seenSet.has(day));
  const remainingDeck = buildBalancedDeck(remainingPool, uniqueSeen);

  return {
    deck: [...uniqueSeen, ...remainingDeck],
    cursor: uniqueSeen.length,
  };
}

async function getSurprisePool() {
  const rows = await prisma.dayHighlightCache.findMany({
    where: {
      type: { not: "none" },
      title: { not: null },
      text: { not: "" },
    },
    select: {
      day: true,
      updatedAt: true,
    },
    orderBy: {
      day: "asc",
    },
  });

  const days = Array.from(
    new Set(rows.map((row) => row.day).filter(isValidDayString))
  );

  const lastUpdatedAt = rows.reduce((max, row) => {
    const time = row.updatedAt.getTime();
    return time > max ? time : max;
  }, 0);

  return {
    days,
    size: days.length,
    signature: `${SURPRISE_DECK_VERSION}:${days.length}:${lastUpdatedAt}`,
  };
}

async function upsertDeck(args: {
  ownerKey: string;
  userId?: string | null;
  deck: string[];
  cursor: number;
  poolSize: number;
  poolSignature: string;
}) {
  const { ownerKey, userId, deck, cursor, poolSize, poolSignature } = args;

  return prisma.surpriseDeck.upsert({
    where: { ownerKey },
    update: {
      userId: userId ?? null,
      deck,
      cursor,
      poolSize,
      poolSignature,
    },
    create: {
      ownerKey,
      userId: userId ?? null,
      deck,
      cursor,
      poolSize,
      poolSignature,
    },
  });
}

export async function claimVisitorDeckToUser(userId: string) {
  const visitorId = await getVisitorId();

  if (!visitorId) return;

  const visitorOwnerKey = `visitor:${visitorId}`;
  const userOwnerKey = `user:${userId}`;

  if (visitorOwnerKey === userOwnerKey) return;

  const pool = await getSurprisePool();

  if (pool.days.length === 0) return;

  const [visitorDeck, userDeck] = await Promise.all([
    prisma.surpriseDeck.findUnique({
      where: { ownerKey: visitorOwnerKey },
    }),
    prisma.surpriseDeck.findUnique({
      where: { ownerKey: userOwnerKey },
    }),
  ]);

  if (!visitorDeck) return;

  const mergedSeenDays = [...getSeenDays(userDeck), ...getSeenDays(visitorDeck)];
  const merged = buildDeckFromSeenDays(pool.days, mergedSeenDays);

  await prisma.$transaction(async (tx) => {
    await tx.surpriseDeck.upsert({
      where: { ownerKey: userOwnerKey },
      update: {
        userId,
        deck: merged.deck,
        cursor: merged.cursor,
        poolSize: pool.size,
        poolSignature: pool.signature,
      },
      create: {
        ownerKey: userOwnerKey,
        userId,
        deck: merged.deck,
        cursor: merged.cursor,
        poolSize: pool.size,
        poolSignature: pool.signature,
      },
    });

    await tx.surpriseDeck
      .delete({
        where: { ownerKey: visitorOwnerKey },
      })
      .catch(() => {});
  });
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

  const ownerKey = userId ? `user:${userId}` : `visitor:${visitorId}`;

  let row = await prisma.surpriseDeck.findUnique({
    where: { ownerKey },
  });

  let deck: string[] = [];
  let cursor = 0;

  if (!row) {
    const fresh = buildFreshDeck(pool.days);
    row = await upsertDeck({
      ownerKey,
      userId,
      deck: fresh.deck,
      cursor: fresh.cursor,
      poolSize: pool.size,
      poolSignature: pool.signature,
    });

    deck = fresh.deck;
    cursor = fresh.cursor;
  } else {
    const storedDeck = normalizeStoredDeck(row.deck);
    const seenDays = getSeenDays(row);

    if (
      row.poolSignature !== pool.signature ||
      storedDeck.length !== pool.days.length
    ) {
      const rebuilt = buildDeckFromSeenDays(pool.days, seenDays);

      row = await upsertDeck({
        ownerKey,
        userId,
        deck: rebuilt.deck,
        cursor: rebuilt.cursor,
        poolSize: pool.size,
        poolSignature: pool.signature,
      });

      deck = rebuilt.deck;
      cursor = rebuilt.cursor;
    } else {
      deck = storedDeck;
      cursor = Math.max(0, Math.min(row.cursor ?? 0, storedDeck.length));
    }
  }

  if (deck.length === 0) {
    return null;
  }

  if (cursor >= deck.length) {
    const fresh = buildFreshDeck(pool.days);

    row = await upsertDeck({
      ownerKey,
      userId,
      deck: fresh.deck,
      cursor: fresh.cursor,
      poolSize: pool.size,
      poolSignature: pool.signature,
    });

    deck = fresh.deck;
    cursor = fresh.cursor;
  }

  let day = deck[cursor];

  if (!isValidDayString(day)) {
    const fresh = buildFreshDeck(pool.days);

    row = await upsertDeck({
      ownerKey,
      userId,
      deck: fresh.deck,
      cursor: fresh.cursor,
      poolSize: pool.size,
      poolSignature: pool.signature,
    });

    deck = fresh.deck;
    cursor = fresh.cursor;
    day = deck[cursor];
  }

  if (!isValidDayString(day)) {
    return null;
  }

  await prisma.surpriseDeck.update({
    where: { ownerKey },
    data: {
      cursor: cursor + 1,
      deck,
      poolSize: pool.size,
      poolSignature: pool.signature,
      userId,
    },
  });

  return {
    day,
    source: "deck" as const,
    remaining: Math.max(0, deck.length - (cursor + 1)),
    total: deck.length,
  };
}
