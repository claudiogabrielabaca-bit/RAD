import { NextResponse } from "next/server";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";
import { isValidDayString } from "@/app/lib/day";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day");

    if (!isValidDayString(day)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }

    const result = await ensureHighlightsForDay(day);

    return NextResponse.json(
      {
        highlight: result.highlight,
        highlights: result.highlights,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("highlight GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}