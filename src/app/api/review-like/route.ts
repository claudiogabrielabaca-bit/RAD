import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getOrCreateAnonId } from "@/app/lib/anon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const anonId = await getOrCreateAnonId();
    const body = await req.json().catch(() => null);

    if (!body || typeof body.ratingId !== "string") {
      return NextResponse.json({ error: "Missing ratingId" }, { status: 400 });
    }

    const { ratingId } = body as { ratingId: string };

    const existing = await prisma.ratingLike.findFirst({
      where: {
        ratingId,
        anonId,
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
        anonId,
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