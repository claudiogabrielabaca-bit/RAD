import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to like reviews." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body.ratingId !== "string") {
      return NextResponse.json({ error: "Missing ratingId" }, { status: 400 });
    }

    const { ratingId } = body as { ratingId: string };

    const review = await prisma.rating.findUnique({
      where: { id: ratingId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot like your own review." },
        { status: 400 }
      );
    }

    const existing = await prisma.ratingLike.findFirst({
      where: {
        ratingId,
        userId: user.id,
      },
    });

    if (existing) {
      await prisma.ratingLike.delete({
        where: {
          id: existing.id,
        },
      });

      const likesCount = await prisma.ratingLike.count({
        where: { ratingId },
      });

      return NextResponse.json({
        ok: true,
        liked: false,
        likesCount,
      });
    }

    await prisma.ratingLike.create({
      data: {
        ratingId,
        userId: user.id,
        anonId: null,
      },
    });

    const likesCount = await prisma.ratingLike.count({
      where: { ratingId },
    });

    return NextResponse.json({
      ok: true,
      liked: true,
      likesCount,
    });
  } catch (error) {
    console.error("review-like POST error:", error);
    return NextResponse.json(
      {
        error: "Server error",
      },
      { status: 500 }
    );
  }
}