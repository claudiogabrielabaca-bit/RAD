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
    const text = body?.text;

    if (!ratingId || typeof ratingId !== "string") {
      return NextResponse.json({ error: "Invalid ratingId" }, { status: 400 });
    }

    if (!text || typeof text !== "string" || text.trim().length < 1) {
      return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });
    }

    if (text.trim().length > 400) {
      return NextResponse.json(
        { error: "Reply is too long (max 400 chars)" },
        { status: 400 }
      );
    }

    const rating = await prisma.rating.findUnique({
      where: { id: ratingId },
      select: {
        id: true,
      },
    });

    if (!rating) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const reply = await prisma.ratingReply.create({
      data: {
        ratingId,
        anonId,
        text: text.trim(),
      },
      select: {
        id: true,
        ratingId: true,
        text: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        reply: {
          ...reply,
          createdAt: reply.createdAt.toISOString(),
          updatedAt: reply.updatedAt.toISOString(),
          isMine: true,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("review-reply POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}