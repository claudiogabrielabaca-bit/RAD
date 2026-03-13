import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDateBetween1900AndToday() {
  const start = new Date("1900-01-01T00:00:00");
  const end = new Date();

  const timestamp = getRandomInt(start.getTime(), end.getTime());
  const d = new Date(timestamp);

  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());

  return `${year}-${month}-${day}`;
}

function isUsableHighlight(result: Awaited<ReturnType<typeof ensureHighlightsForDay>>) {
  const highlight = result.highlight;

  return !!(
    highlight &&
    highlight.type !== "none" &&
    highlight.text &&
    highlight.text.trim().length > 0
  );
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
    const validDays = await prisma.dayHighlightCache.findMany({
      where: {
        type: {
          not: "none",
        },
        title: {
          not: null,
        },
      },
      select: {
        day: true,
      },
      take: maxCacheTake,
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (validDays.length > 0) {
      const randomIndex = Math.floor(Math.random() * validDays.length);
      return {
        day: validDays[randomIndex].day,
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