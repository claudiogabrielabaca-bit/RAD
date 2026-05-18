import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getTodayValidDay } from "@/app/lib/today-valid-day";
import { buildDayBundle } from "@/app/lib/day-bundle";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";
import {
  isValidDayString,
  isValidMonthDayString,
} from "@/app/lib/day";
import type { HighlightItem } from "@/app/lib/rad-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMPTY_FALLBACK_TEXT = "No exact historical match was found for this date.";
const MAX_BUNDLE_ATTEMPTS = 12;
const MAX_EXCLUDE_DAYS = 1000;
const MAX_LIVE_HIGHLIGHT_CHECKS = 1;

type DayBundlePayload = Awaited<ReturnType<typeof buildDayBundle>>;

type CachedHighlightViability = "usable" | "unusable" | "unknown";

type CachedHighlightRow = {
  day?: string;
  title: string | null;
  text: string;
  type: string;
};

type HighlightReadiness = {
  usable: boolean;
  usedLiveLookup: boolean;
  shouldRemoveFromPool: boolean;
  reason:
    | "cached-usable"
    | "cached-unusable"
    | "live-usable"
    | "live-confirmed-unusable"
    | "live-unresolved"
    | "live-budget-exhausted";
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getCurrentMonthDay() {
  const now = new Date();
  return `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function parseExcludeDays(searchParams: URLSearchParams) {
  const raw = searchParams.get("excludeDays") ?? "";

  if (!raw.trim()) return [];

  return Array.from(
    new Set(raw.split(",").map((item) => item.trim()).filter(isValidDayString))
  ).slice(0, MAX_EXCLUDE_DAYS);
}

function normalizePoolDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(
      raw.filter(
        (item): item is string =>
          typeof item === "string" && isValidDayString(item)
      )
    )
  ).sort();
}

function isUsableHighlightLike(
  row: CachedHighlightRow | HighlightItem | null | undefined
) {
  if (!row) return false;
  if (row.type === "none") return false;
  if (!row.title?.trim()) return false;
  if (!row.text?.trim()) return false;
  if (row.text.trim() === EMPTY_FALLBACK_TEXT) return false;

  return true;
}

function isUnusableCachedHighlight(row: CachedHighlightRow | null | undefined) {
  if (!row) return false;
  if (row.type === "none") return true;
  if (!row.text?.trim()) return true;
  if (row.text.trim() === EMPTY_FALLBACK_TEXT) return true;
  if (!row.title?.trim()) return true;

  return false;
}

function isUsableBundle(payload: DayBundlePayload) {
  return isUsableHighlightLike(payload.highlightData?.highlight);
}

async function readCachedHighlightViability(
  day: string
): Promise<CachedHighlightViability> {
  if (!isValidDayString(day)) return "unusable";

  const row = await prisma.dayHighlightCache.findUnique({
    where: { day },
    select: {
      title: true,
      text: true,
      type: true,
    },
  });

  if (!row) {
    return "unknown";
  }

  if (isUsableHighlightLike(row)) {
    return "usable";
  }

  if (isUnusableCachedHighlight(row)) {
    return "unusable";
  }

  return "unknown";
}

async function pickCachedUsableTodayPoolDay(
  monthDay: string,
  excludedSet: Set<string>
) {
  const row = await prisma.todayHistoryPool.findUnique({
    where: { monthDay },
    select: {
      validDays: true,
    },
  });

  const poolDays = normalizePoolDays(row?.validDays).filter(
    (day) => !excludedSet.has(day)
  );

  if (poolDays.length === 0) {
    return null;
  }

  const highlightRows = await prisma.dayHighlightCache.findMany({
    where: {
      day: {
        in: poolDays,
      },
    },
    select: {
      day: true,
      title: true,
      text: true,
      type: true,
    },
  });

  const usableDays = highlightRows
    .filter((candidate) => isUsableHighlightLike(candidate))
    .map((candidate) => candidate.day)
    .filter(isValidDayString);

  if (usableDays.length === 0) {
    return null;
  }

  return shuffleArray(usableDays)[0] ?? null;
}

async function checkHighlightBeforeBundle(
  day: string,
  options: {
    allowLiveLookup: boolean;
  }
): Promise<HighlightReadiness> {
  const cachedViability = await readCachedHighlightViability(day);

  if (cachedViability === "usable") {
    return {
      usable: true,
      usedLiveLookup: false,
      shouldRemoveFromPool: false,
      reason: "cached-usable",
    };
  }

  if (cachedViability === "unusable") {
    return {
      usable: false,
      usedLiveLookup: false,
      shouldRemoveFromPool: true,
      reason: "cached-unusable",
    };
  }

  if (!options.allowLiveLookup) {
    return {
      usable: false,
      usedLiveLookup: false,
      shouldRemoveFromPool: false,
      reason: "live-budget-exhausted",
    };
  }

  const highlights = await ensureHighlightsForDay(day);

  if (isUsableHighlightLike(highlights.highlight)) {
    return {
      usable: true,
      usedLiveLookup: true,
      shouldRemoveFromPool: false,
      reason: "live-usable",
    };
  }

  const viabilityAfterLookup = await readCachedHighlightViability(day);

  if (viabilityAfterLookup === "unusable") {
    return {
      usable: false,
      usedLiveLookup: true,
      shouldRemoveFromPool: true,
      reason: "live-confirmed-unusable",
    };
  }

  return {
    usable: false,
    usedLiveLookup: true,
    shouldRemoveFromPool: false,
    reason: "live-unresolved",
  };
}

async function removeDayFromTodayPool(day: string) {
  if (!isValidDayString(day)) return;

  const monthDay = day.slice(5, 10);

  const row = await prisma.todayHistoryPool.findUnique({
    where: { monthDay },
    select: {
      validDays: true,
    },
  });

  const currentDays = normalizePoolDays(row?.validDays);
  const nextDays = currentDays.filter((candidate) => candidate !== day);

  if (nextDays.length === currentDays.length) return;

  await prisma.todayHistoryPool.update({
    where: { monthDay },
    data: {
      validDays: nextDays,
      validCount: nextDays.length,
    },
  });

  console.warn("today-valid-day removed unusable day from pool:", {
    day,
    monthDay,
    previousCount: currentDays.length,
    nextCount: nextDays.length,
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get("fresh") === "1";
    const bundle = searchParams.get("bundle") === "1";
    const requestedMonthDay = searchParams.get("monthDay");
    const monthDay = isValidMonthDayString(requestedMonthDay)
      ? requestedMonthDay
      : undefined;

    const effectiveMonthDay = monthDay ?? getCurrentMonthDay();
    const baseExcludeDays = parseExcludeDays(searchParams);

    if (!bundle) {
      const result = await getTodayValidDay({
        fresh,
        maxAttempts: 72,
        excludeDays: baseExcludeDays,
        monthDay,
      });

      if (!result) {
        return NextResponse.json(
          { error: "No valid 'today in history' day found." },
          { status: 404 }
        );
      }

      return NextResponse.json(result, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const triedDays = new Set<string>(baseExcludeDays);
    const skippedDays: string[] = [];

    if (!fresh) {
      const cachedUsableDay = await pickCachedUsableTodayPoolDay(
        effectiveMonthDay,
        triedDays
      );

      if (cachedUsableDay) {
        const payload = await buildDayBundle(cachedUsableDay);

        if (isUsableBundle(payload)) {
          return NextResponse.json(
            {
              ...payload,
              source: "cache",
              restartedRound: false,
              todayAttemptCount: 0,
              todaySkippedDays: skippedDays,
            },
            {
              headers: {
                "Cache-Control": "no-store",
              },
            }
          );
        }

        triedDays.add(cachedUsableDay);
        skippedDays.push(cachedUsableDay);
      }
    }

    let liveHighlightChecks = 0;

    for (let attempt = 0; attempt < MAX_BUNDLE_ATTEMPTS; attempt += 1) {
      const result = await getTodayValidDay({
        fresh: fresh && attempt === 0,
        maxAttempts: 72,
        excludeDays: Array.from(triedDays),
        monthDay,
      });

      if (!result) break;

      triedDays.add(result.day);

      const readiness = await checkHighlightBeforeBundle(result.day, {
        allowLiveLookup: liveHighlightChecks < MAX_LIVE_HIGHLIGHT_CHECKS,
      });

      if (readiness.usedLiveLookup) {
        liveHighlightChecks += 1;
      }

      if (!readiness.usable) {
        skippedDays.push(result.day);

        console.warn("today-valid-day skipped highlight before bundle:", {
          day: result.day,
          attempt: attempt + 1,
          reason: readiness.reason,
          liveHighlightChecks,
        });

        if (readiness.shouldRemoveFromPool) {
          await removeDayFromTodayPool(result.day);
        }

        continue;
      }

      const payload = await buildDayBundle(result.day);

      if (isUsableBundle(payload)) {
        return NextResponse.json(
          {
            ...payload,
            source: result.source,
            restartedRound: result.restartedRound ?? false,
            todayAttemptCount: attempt + 1,
            todaySkippedDays: skippedDays,
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          }
        );
      }

      skippedDays.push(result.day);

      console.warn("today-valid-day skipped unusable bundle:", {
        day: result.day,
        title: payload.highlightData?.highlight?.title ?? null,
        type: payload.highlightData?.highlight?.type ?? null,
        attempt: attempt + 1,
      });

      await removeDayFromTodayPool(result.day);
    }

    return NextResponse.json(
      {
        error: "No valid 'today in history' day found after bundle validation.",
        skippedDays,
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("today-valid-day GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}