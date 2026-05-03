import { NextResponse } from "next/server";
import { buildPickDateBundle } from "@/app/lib/pick-date-bundle";
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

    const payload = await buildPickDateBundle(day);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("pick-date-bundle GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
