import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getTodayValidDay } from "@/app/lib/today-valid-day";
import { buildDayBundle } from "@/app/lib/day-bundle";
import {
  isValidDayString,
  isValidMonthDayString,
} from "@/app/lib/day";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMPTY_FALLBACK_TEXT = "No exact historical match was found for this date.";
const MAX_BUNDLE_ATTEMPTS = 12;
const MAX_EXCLUDE_DAYS = 1000;

type DayBundlePayload = Awaited<ReturnType<typeof buildDayBundle>>;

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

function isUsableBundle(payload: DayBundlePayload) {
  const highlight = payload.highlightData?.highlight;

  if (!highlight) return false;
  if (highlight.type === "none") return false;
  if (!highlight.title?.trim()) return false;
  if (!highlight.text?.trim()) return false;
  if (highlight.text.trim() === EMPTY_FALLBACK_TEXT) return false;

  return true;
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

    for (let attempt = 0; attempt < MAX_BUNDLE_ATTEMPTS; attempt += 1) {
      const result = await getTodayValidDay({
        fresh: fresh && attempt === 0,
        maxAttempts: 72,
        excludeDays: Array.from(triedDays),
        monthDay,
      });

      if (!result) break;

      triedDays.add(result.day);

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