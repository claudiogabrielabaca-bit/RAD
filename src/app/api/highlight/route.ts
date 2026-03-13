import { NextResponse } from "next/server";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day");

    if (!day || !isValidDay(day)) {
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