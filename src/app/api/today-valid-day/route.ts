import { NextResponse } from "next/server";
import { getTodayValidDay } from "@/app/lib/today-valid-day";
import { buildDayBundle } from "@/app/lib/day-bundle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get("fresh") === "1";
    const bundle = searchParams.get("bundle") === "1";

    const result = await getTodayValidDay({
      fresh,
      maxCacheTake: 200,
      maxAttempts: 12,
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