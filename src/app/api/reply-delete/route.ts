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
        { error: "You must be logged in to delete a reply." },
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
        userId: true,
      },
    });

    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    if (reply.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.ratingReply.delete({
      where: { id: replyId },
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
    console.error("reply-delete POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}