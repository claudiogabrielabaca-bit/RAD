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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i--) {
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
  return day.slice(5, 10); // MM-DD
}

function getDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

function getBalancedRandomDateBetween1900AndToday() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const year = getRandomInt(1900, currentYear);
  const maxMonth = year === currentYear ? now.getMonth() + 1 : 12;
  const month = getRandomInt(1, maxMonth);

  const maxDay =
    year === currentYear && month === now.getMonth() + 1
      ? now.getDate()
      : getDaysInMonth(year, month);

  const day = getRandomInt(1, maxDay);

  return `${year}-${pad2(month)}-${pad2(day)}`;
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

function getUniqueDays(days: string[]) {
  return Array.from(new Set(days.filter(Boolean)));
}

function incrementMapCount<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function pickWeightedRandomDay(
  entries: Array<{ day: string; weight: number }>
): string | null {
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((acc, item) => acc + item.weight, 0);

  if (totalWeight <= 0) {
    return shuffleArray(entries.map((item) => item.day))[0] ?? null;
  }

  let roll = Math.random() * totalWeight;

  for (const item of entries) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.day;
    }
  }

  return entries[entries.length - 1]?.day ?? null;
}

function pickBalancedDay(days: string[]) {
  const uniqueDays = getUniqueDays(days);

  if (uniqueDays.length === 0) return null;
  if (uniqueDays.length === 1) return uniqueDays[0];

  const monthCounts = new Map<number, number>();
  const decadeCounts = new Map<number, number>();
  const yearCounts = new Map<number, number>();
  const monthDayCounts = new Map<string, number>();
  const dayOfMonthCounts = new Map<number, number>();

  for (const day of uniqueDays) {
    const year = parseYear(day);
    const month = parseMonth(day);
    const dayOfMonth = parseDayOfMonth(day);
    const monthDay = parseMonthDay(day);
    const decade = getDecade(year);

    incrementMapCount(monthCounts, month);
    incrementMapCount(decadeCounts, decade);
    incrementMapCount(yearCounts, year);
    incrementMapCount(monthDayCounts, monthDay);
    incrementMapCount(dayOfMonthCounts, dayOfMonth);
  }

  const weighted = uniqueDays.map((day) => {
    const year = parseYear(day);
    const month = parseMonth(day);
    const dayOfMonth = parseDayOfMonth(day);
    const monthDay = parseMonthDay(day);
    const decade = getDecade(year);

    const monthCount = monthCounts.get(month) ?? 1;
    const decadeCount = decadeCounts.get(decade) ?? 1;
    const yearCount = yearCounts.get(year) ?? 1;
    const monthDayCount = monthDayCounts.get(monthDay) ?? 1;
    const dayOfMonthCount = dayOfMonthCounts.get(dayOfMonth) ?? 1;

    // Penalización fuerte al MM-DD repetido
    // Penalización media al mes y década
    // Penalización suave al año y día del mes
    const weight =
      1 /
      (Math.pow(monthDayCount, 1.35) *
        Math.pow(monthCount, 0.75) *
        Math.pow(decadeCount, 0.7) *
        Math.pow(yearCount, 0.35) *
        Math.pow(dayOfMonthCount, 0.2));

    return { day, weight };
  });

  return pickWeightedRandomDay(weighted);
}

export async function sampleRandomCachedHighlights(options?: {
  sampleSize?: number;
  requireImage?: boolean;
}) {
  const sampleSize = Math.max(1, Math.min(100, options?.sampleSize ?? 24));
  const requireImage = options?.requireImage ?? false;

  const take = Math.max(sampleSize * 8, 80);

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
    (item) =>
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
  const maxAttempts = options?.maxAttempts ?? 20;
  const maxCacheTake = options?.maxCacheTake ?? 5000;
  const excludeDays = getUniqueDays(options?.excludeDays ?? []);
  const excludedSet = new Set(excludeDays);

  if (!fresh) {
    const validDays = await prisma.dayHighlightCache.findMany({
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
    });

    const shuffledPool = shuffleArray(validDays.map((item) => item.day));
    const sampledPool = shuffledPool.slice(0, maxCacheTake);
    const pickedFromCache = pickBalancedDay(sampledPool);

    if (pickedFromCache) {
      return {
        day: pickedFromCache,
        source: "cache",
      };
    }
  }

  const tried = new Set<string>(excludeDays);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let candidate = getBalancedRandomDateBetween1900AndToday();
    let safety = 0;

    while ((tried.has(candidate) || excludedSet.has(candidate)) && safety < 200) {
      candidate = getBalancedRandomDateBetween1900AndToday();
      safety++;
    }

    if (tried.has(candidate) || excludedSet.has(candidate)) {
      continue;
    }

    tried.add(candidate);

    try {
      const result = await ensureHighlightsForDay(candidate);

      if (isUsableHighlight(result)) {
        return {
          day: candidate,
          source: "generated",
        };
      }
    } catch (error) {
      console.error(`[random-valid-day] attempt failed for ${candidate}`, error);
    }
  }

  return null;
}