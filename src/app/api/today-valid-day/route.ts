import { NextResponse } from "next/server";
import { getTodayValidDay } from "@/app/lib/today-valid-day";
import { buildDayBundle } from "@/app/lib/day-bundle";
import {
  isValidDayString,
  isValidMonthDayString,
} from "@/app/lib/day";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseExcludeDays(searchParams: URLSearchParams) {
  const raw = searchParams.get("excludeDays") ?? "";

  if (!raw.trim()) return [];

  return Array.from(
    new Set(raw.split(",").map((item) => item.trim()).filter(isValidDayString))
  ).slice(0, 160);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get("fresh") === "1";
    const bundle = searchParams.get("bundle") === "1";
    const excludeDays = parseExcludeDays(searchParams);
    const requestedMonthDay = searchParams.get("monthDay");
    const monthDay = isValidMonthDayString(requestedMonthDay)
      ? requestedMonthDay
      : undefined;

    const result = await getTodayValidDay({
      fresh,
      maxAttempts: 72,
      excludeDays,
      monthDay,
    });

    if (!result) {
      return NextResponse.json(
        { error: "No valid 'today in history' day found." },
        { status: 404 }
      );
    }

    if (!bundle) {
      return NextResponse.json(result, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const payload = await buildDayBundle(result.day);

    return NextResponse.json(
      {
        ...payload,
        source: result.source,
        restartedRound: result.restartedRound ?? false,
      },
      {
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