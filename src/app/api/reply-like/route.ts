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
        { error: "You must be logged in to like a reply." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const replyId = body?.replyId;

    if (!replyId || typeof replyId !== "string") {
      return NextResponse.json({ error: "Invalid replyId" }, { status: 400 });
    }

    const reply = await prisma.ratingReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
      },
    });

    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    const existingLike = await prisma.replyLike.findFirst({
      where: {
        replyId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (existingLike) {
      await prisma.replyLike.delete({
        where: {
          id: existingLike.id,
        },
      });
    } else {
      await prisma.replyLike.create({
        data: {
          replyId,
          userId: user.id,
          anonId: null,
        },
      });
    }

    const likesCount = await prisma.replyLike.count({
      where: { replyId },
    });

    return NextResponse.json(
      {
        ok: true,
        likedByMe: !existingLike,
        likesCount,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("reply-like POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}