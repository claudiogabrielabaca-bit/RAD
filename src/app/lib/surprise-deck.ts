import { prisma } from "@/app/lib/prisma";
import { getOrCreateVisitorId, getVisitorId } from "@/app/lib/visitor-id";

const SURPRISE_DECK_VERSION = "v3-month-cooldown-4-natural";
const MONTH_COOLDOWN = 4;

type DeckRowLike = {
  deck: unknown;
  cursor: number;
};

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseMonth(day: string) {
  return Number(day.slice(5, 7));
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i--) {
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

function pickRandomItem<T>(items: T[]) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function buildMonthSpacedDeck(
  days: string[],
  recentContextDays: string[] = [],
  monthCooldown = MONTH_COOLDOWN
) {
  const uniqueDays = Array.from(
    new Set(days.filter((day): day is string => isValidDayString(day)))
  );

  const buckets = new Map<number, string[]>();

  for (const day of uniqueDays) {
    const month = parseMonth(day);
    const current = buckets.get(month) ?? [];
    current.push(day);
    buckets.set(month, current);
  }

  for (const [month, bucket] of buckets.entries()) {
    buckets.set(month, shuffleArray(bucket));
  }

  const recentMonths = recentContextDays
    .filter(isValidDayString)
    .map(parseMonth)
    .slice(-monthCooldown);

  const arranged: string[] = [];

  while (true) {
    const available = [...buckets.entries()]
      .filter(([, bucket]) => bucket.length > 0)
      .map(([month]) => month);

    if (available.length === 0) {
      break;
    }

    let candidates = available.filter(
      (month) => !recentMonths.includes(month)
    );

    // fallback para evitar dead-end al final del deck
    if (candidates.length === 0) {
      candidates = available;
    }

    const chosenMonth = pickRandomItem(candidates);

    if (!chosenMonth) {
      break;
    }

    const bucket = buckets.get(chosenMonth);
    const nextDay = bucket?.pop();

    if (!nextDay) {
      continue;
    }

    arranged.push(nextDay);

    recentMonths.push(chosenMonth);
    if (recentMonths.length > monthCooldown) {
      recentMonths.shift();
    }
  }

  return arranged;
}

function buildFreshDeck(poolDays: string[]) {
  return {
    deck: buildMonthSpacedDeck(poolDays),
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
  const remainingDeck = buildMonthSpacedDeck(remainingPool, uniqueSeen);

  return {
    deck: [...uniqueSeen, ...remainingDeck],
    cursor: uniqueSeen.length,
  };
}

async function getSurprisePool() {
  const rows = await prisma.dayHighlightCache.findMany({
    where: {
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
    where: {
      ownerKey,
    },
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
      where: {
        ownerKey: visitorOwnerKey,
      },
    }),
    prisma.surpriseDeck.findUnique({
      where: {
        ownerKey: userOwnerKey,
      },
    }),
  ]);

  if (!visitorDeck) return;

  const mergedSeenDays = [...getSeenDays(userDeck), ...getSeenDays(visitorDeck)];
  const merged = buildDeckFromSeenDays(pool.days, mergedSeenDays);

  await prisma.$transaction(async (tx) => {
    await tx.surpriseDeck.upsert({
      where: {
        ownerKey: userOwnerKey,
      },
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
        where: {
          ownerKey: visitorOwnerKey,
        },
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
    where: {
      ownerKey,
    },
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
    where: {
      ownerKey,
    },
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