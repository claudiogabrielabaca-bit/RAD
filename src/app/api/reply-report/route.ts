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
        { error: "You must be logged in to report a reply." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => null);
    const replyId = body?.replyId;
    const reason = body?.reason;

    if (!replyId || typeof replyId !== "string") {
      return NextResponse.json(
        { error: "Invalid replyId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
      return NextResponse.json(
        { error: "Report reason must be at least 3 characters." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const trimmedReason = reason.trim();

    const reply = await prisma.ratingReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!reply) {
      return NextResponse.json(
        { error: "Reply not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (reply.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot report your own reply." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const reportWhere = {
      reply_report_user_unique: {
        replyId,
        userId: user.id,
      },
    } as const;

    const existingReport = await prisma.replyReport.findUnique({
      where: reportWhere,
      select: {
        id: true,
      },
    });

    const report = await prisma.replyReport.upsert({
      where: reportWhere,
      update: {
        reason: trimmedReason,
        status: "pending",
      },
      create: {
        replyId,
        userId: user.id,
        anonId: null,
        reason: trimmedReason,
        status: "pending",
      },
      select: {
        id: true,
        replyId: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        alreadyReported: !!existingReport,
        message: existingReport ? "Report updated" : "Report received",
        report: {
          ...report,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
        },
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("reply-report POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}