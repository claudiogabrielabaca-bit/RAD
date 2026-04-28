import { NextResponse } from "next/server";
import { simulateSurpriseDays } from "@/app/lib/surprise-deck";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getMonthDay(day: string) {
  return day.slice(5, 10);
}

function getMonth(day: string) {
  return day.slice(5, 7);
}

function getDecade(day: string) {
  const year = Number(day.slice(0, 4));
  return Math.floor(year / 10) * 10;
}

function getCentury(day: string) {
  const year = Number(day.slice(0, 4));
  return Math.floor(year / 100) * 100;
}

function topCounts(values: string[], limit = 15) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

function summarizeWindow(days: string[], size: number) {
  const window = days.slice(0, size);
  const uniqueDays = new Set(window).size;
  const monthDays = window.map(getMonthDay);
  const months = window.map(getMonth);
  const decades = window.map((day) => String(getDecade(day)));
  const centuries = window.map((day) => String(getCentury(day)));

  return {
    size,
    actualCount: window.length,
    uniqueDays,
    repeatedExactDays: window.length - uniqueDays,
    topRepeatedExactDays: topCounts(window, 10),
    topRepeatedMonthDays: topCounts(monthDays, 10),
    topRepeatedMonths: topCounts(months, 12),
    topRepeatedDecades: topCounts(decades, 10),
    topRepeatedCenturies: topCounts(centuries, 10),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedCount = Number(searchParams.get("count") ?? "1000");
    const count = Math.max(1, Math.min(requestedCount, 5000));

    const simulation = await simulateSurpriseDays(count);
    const days = simulation.days;
    const uniqueDays = new Set(days).size;
    const repeatedDraws = days.length - uniqueDays;

    const months = days.map(getMonth);
    const monthDays = days.map(getMonthDay);
    const decades = days.map((day) => String(getDecade(day)));
    const centuries = days.map((day) => String(getCentury(day)));

    return NextResponse.json(
      {
        requestedCount: count,
        actualCount: days.length,
        poolTotal: simulation.total,
        uniqueDays,
        repeatedDraws,
        minimumPossibleRepeatedDraws: Math.max(0, days.length - simulation.total),
        repetitionRate:
          days.length > 0 ? Number((repeatedDraws / days.length).toFixed(4)) : 0,
        note: "Simulation only. This endpoint does not write to SurpriseDeck.",
        interpretation:
          "v19 prioritizes perceived balance by month and month-day over exhausting every exact date before repeating.",
        poolSignature: simulation.poolSignature,
        first50Days: days.slice(0, 50),
        windows: {
          first25: summarizeWindow(days, 25),
          first50: summarizeWindow(days, 50),
          first100: summarizeWindow(days, 100),
        },
        topRepeatedExactDays: topCounts(days, 20),
        topRepeatedMonthDays: topCounts(monthDays, 20),
        topRepeatedMonths: topCounts(months, 12),
        topRepeatedDecades: topCounts(decades, 20),
        topRepeatedCenturies: topCounts(centuries, 20),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("surprise-test GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}