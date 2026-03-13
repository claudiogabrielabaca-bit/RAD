import { NextResponse } from "next/server";
import { getRandomValidDay } from "@/app/lib/random-valid-day";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get("fresh") === "1";

    const result = await getRandomValidDay({
      fresh,
      maxCacheTake: 500,
      maxAttempts: 12,
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