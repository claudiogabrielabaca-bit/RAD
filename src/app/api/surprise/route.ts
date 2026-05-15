import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { getNextSurpriseDay } from "@/app/lib/surprise-deck";
import { buildDayBundle } from "@/app/lib/day-bundle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET() {
  try {
    const user = await getCurrentUser();

    const result = await getNextSurpriseDay({
      userId: user?.id ?? null,
    });

    if (!result) {
      return NextResponse.json(
        { error: "No valid surprise day found." },
        {
          status: 404,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const bundle = await buildDayBundle(result.day);

    return NextResponse.json(
      {
        ...bundle,
        source: result.source,
        remaining: result.remaining,
        total: result.total,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("surprise GET error:", error);

    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}