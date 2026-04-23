import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to delete a review." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => null);
    const ratingId = body?.ratingId;

    if (!ratingId || typeof ratingId !== "string") {
      return NextResponse.json(
        { error: "Invalid ratingId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const review = await prisma.rating.findUnique({
      where: { id: ratingId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (review.userId !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own review." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    await prisma.rating.delete({
      where: { id: ratingId },
    });

    return NextResponse.json(
      { ok: true },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("review-delete POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}