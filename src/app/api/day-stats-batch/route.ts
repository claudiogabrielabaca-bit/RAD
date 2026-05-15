import { NextResponse } from "next/server";
import { getDayStatsMap, normalizeStatsDayList } from "@/app/lib/day-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BATCH_DAYS = 120;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const rawDays = Array.isArray(body?.days) ? body.days : [];
    const days = normalizeStatsDayList(rawDays).slice(0, MAX_BATCH_DAYS);

    if (days.length === 0) {
      return NextResponse.json(
        { stats: {} },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const stats = await getDayStatsMap(days);

    return NextResponse.json(
      { stats },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("day-stats-batch POST error:", error);

    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}