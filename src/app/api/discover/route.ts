import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

type CachedHighlightRow = {
  day: string;
  title: string | null;
  text: string;
  image: string | null;
  type: string;
  year: number | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getDayYear(day: string) {
  return Number(day.slice(0, 4)) || 0;
}

function getDayDecade(day: string) {
  const year = getDayYear(day);
  return year ? Math.floor(year / 10) * 10 : 0;
}

function buildCacheWhere(requireImage: boolean) {
  return {
    type: {
      not: "none" as const,
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
  };
}

function isUsableCachedRow(
  row: CachedHighlightRow,
  requireImage: boolean = false
) {
  return !!(
    isValidDayString(row.day) &&
    row.type !== "none" &&
    row.title?.trim() &&
    row.text?.trim() &&
    (!requireImage || row.image?.trim())
  );
}

function getRandomDateBetween1900AndToday() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const year = getRandomInt(1900, currentYear);
  const maxMonth = year === currentYear ? now.getMonth() + 1 : 12;
  const month = getRandomInt(1, maxMonth);

  const maxDay =
    year === currentYear && month === now.getMonth() + 1
      ? now.getDate()
      : new Date(year, month, 0).getDate();

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

export async function sampleRandomCachedHighlights(options?: {
  sampleSize?: number;
  requireImage?: boolean;
}) {
  const sampleSize = clamp(options?.sampleSize ?? 36, 1, 96);
  const requireImage = options?.requireImage ?? false;

  const where = buildCacheWhere(requireImage);
  const total = await prisma.dayHighlightCache.count({ where });

  if (!total) {
    return [] as CachedHighlightRow[];
  }

  const desired = Math.min(sampleSize, total);
  const windowSize = clamp(Math.min(12, desired), 1, 12);
  const maxStart = Math.max(0, total - windowSize);

  const windowsToFetch = Math.min(
    6,
    Math.max(1, Math.ceil(desired / windowSize) + 1)
  );

  const offsets = new Set<number>();
  let guard = 0;

  while (offsets.size < windowsToFetch && guard < 32) {
    offsets.add(maxStart === 0 ? 0 : getRandomInt(0, maxStart));
    guard++;
  }

  const batches = await Promise.all(
    [...offsets].map((skip) =>
      prisma.dayHighlightCache.findMany({
        where,
        select: {
          day: true,
          title: true,
          text: true,
          image: true,
          type: true,
          year: true,
        },
        orderBy: {
          day: "asc",
        },
        skip,
        take: windowSize,
      })
    )
  );

  const unique = new Map<string, CachedHighlightRow>();
  const merged = shuffleArray(batches.flat());

  for (const row of merged) {
    if (!isUsableCachedRow(row, requireImage)) continue;
    if (unique.has(row.day)) continue;

    unique.set(row.day, row);

    if (unique.size >= desired) {
      break;
    }
  }

  return shuffleArray([...unique.values()]);
}

function pickRandomCachedDay(candidates: CachedHighlightRow[]) {
  if (!candidates.length) return null;

  const buckets = new Map<number, CachedHighlightRow[]>();

  for (const item of candidates) {
    const decade = getDayDecade(item.day);

    if (!buckets.has(decade)) {
      buckets.set(decade, []);
    }

    buckets.get(decade)?.push(item);
  }

  const decadeKeys = shuffleArray([...buckets.keys()]);
  const chosenDecade = decadeKeys[0];

  if (chosenDecade == null) {
    return candidates[getRandomInt(0, candidates.length - 1)] ?? null;
  }

  const decadeItems = buckets.get(chosenDecade) ?? candidates;
  return decadeItems[getRandomInt(0, decadeItems.length - 1)] ?? null;
}

export async function getRandomValidDay(options?: {
  fresh?: boolean;
  maxCacheTake?: number;
  maxAttempts?: number;
}) {
  const fresh = options?.fresh ?? false;
  const maxCacheTake = options?.maxCacheTake ?? 500;
  const maxAttempts = options?.maxAttempts ?? 12;

  if (!fresh) {
    const cacheCandidates = await sampleRandomCachedHighlights({
      sampleSize: Math.min(maxCacheTake, 48),
      requireImage: false,
    });

    const picked = pickRandomCachedDay(cacheCandidates);

    if (picked) {
      return {
        day: picked.day,
        source: "cache" as const,
      };
    }
  }

  const tried = new Set<string>();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let candidate = getRandomDateBetween1900AndToday();

    while (tried.has(candidate)) {
      candidate = getRandomDateBetween1900AndToday();
    }

    tried.add(candidate);

    try {
      const result = await ensureHighlightsForDay(candidate);

      if (isUsableHighlight(result)) {
        return {
          day: candidate,
          source: "generated" as const,
        };
      }
    } catch (error) {
      console.error(`[random-valid-day] attempt failed for ${candidate}`, error);
    }
  }

  return null;
}