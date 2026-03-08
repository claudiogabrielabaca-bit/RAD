import { NextResponse } from "next/server";
import { getDayHighlight, getDayHighlights } from "@/app/lib/wiki";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const day = searchParams.get("day");

    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }

    const highlights = await getDayHighlights(day);
    const highlight = highlights[0] ?? (await getDayHighlight(day));

    return NextResponse.json({
      highlight,
      highlights,
    });
  } catch (error) {
    console.error("highlight GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}