import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getOrCreateAnonId } from "@/app/lib/anon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const anonId = await getOrCreateAnonId();
    const body = await req.json().catch(() => null);
    const ratingId = body?.ratingId;

    if (!ratingId || typeof ratingId !== "string") {
      return NextResponse.json({ error: "Invalid ratingId" }, { status: 400 });
    }

    const rating = await prisma.rating.findUnique({
      where: { id: ratingId },
      select: {
        id: true,
        anonId: true,
      },
    });

    if (!rating) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (rating.anonId !== anonId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.rating.delete({
      where: { id: ratingId },
    });

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("review-delete POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}