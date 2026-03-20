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
        { error: "You must be logged in to report a reply." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const replyId = body?.replyId;
    const reason = body?.reason;

    if (!replyId || typeof replyId !== "string") {
      return NextResponse.json({ error: "Invalid replyId" }, { status: 400 });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
      return NextResponse.json(
        { error: "Report reason must be at least 3 characters." },
        { status: 400 }
      );
    }

    const reply = await prisma.ratingReply.findUnique({
      where: { id: replyId },
      select: { id: true },
    });

    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    const existingReport = await prisma.replyReport.findFirst({
      where: {
        replyId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (existingReport) {
      return NextResponse.json(
        {
          ok: true,
          alreadyReported: true,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    await prisma.replyReport.create({
      data: {
        replyId,
        userId: user.id,
        anonId: null,
        reason: reason.trim(),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        alreadyReported: false,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("reply-report POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}