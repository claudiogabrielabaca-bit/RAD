import { prisma } from "@/app/lib/prisma";
import { refreshDayRatingAggregate } from "@/app/lib/rating-aggregates";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const MAX_RATING_ID_LENGTH = 80;

export async function POST(req: Request) {
  try {
    const adminSession = await requireAdminSession();

    if (!adminSession) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => null);
    const ratingId =
      typeof body?.ratingId === "string" ? body.ratingId.trim() : null;

    if (!ratingId || ratingId.length > MAX_RATING_ID_LENGTH) {
      return NextResponse.json(
        { error: "Invalid ratingId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rating = await prisma.rating.findUnique({
      where: { id: ratingId },
      select: {
        id: true,
        day: true,
      },
    });

    if (!rating) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    await prisma.rating.delete({
      where: { id: ratingId },
    });

    await refreshDayRatingAggregate(rating.day);

    return NextResponse.json(
      {
        ok: true,
        deleted: {
          id: rating.id,
          day: rating.day,
        },
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("admin delete-review POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
