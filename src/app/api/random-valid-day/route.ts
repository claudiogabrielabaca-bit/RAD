import { NextResponse } from "next/server";
import { getRandomValidDay } from "@/app/lib/random-valid-day";

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
  ).slice(0, 30);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get("fresh") === "1";
    const excludeDays = parseExcludeDays(searchParams);

    const result = await getRandomValidDay({
      fresh,
      maxAttempts: 12,
      excludeDays,
    });

    if (!result) {
      return NextResponse.json(
        { error: "No valid random day found." },
        { status: 404 }
      );
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("random-valid-day GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}