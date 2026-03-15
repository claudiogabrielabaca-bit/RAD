import { NextResponse } from "next/server";
import { getTodayValidDay } from "@/app/lib/today-valid-day";
import { buildDayBundle } from "@/app/lib/day-bundle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

    const result = await getTodayValidDay({
      fresh,
      maxAttempts: 160,
      excludeDays,
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
        restartedRound: result.restartedRound,
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