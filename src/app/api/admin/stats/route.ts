import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET() {
  try {
    const adminSession = await requireAdminSession();

    if (!adminSession) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const [
      usersCount,
      reviewsCount,
      repliesCount,
      reviewReportsCount,
      replyReportsCount,
      pendingReviewReportsCount,
      resolvedReviewReportsCount,
      pendingReplyReportsCount,
      resolvedReplyReportsCount,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.rating.count(),
      prisma.ratingReply.count(),
      prisma.reviewReport.count(),
      prisma.replyReport.count(),
      prisma.reviewReport.count({
        where: {
          status: "pending",
        },
      }),
      prisma.reviewReport.count({
        where: {
          status: "resolved",
        },
      }),
      prisma.replyReport.count({
        where: {
          status: "pending",
        },
      }),
      prisma.replyReport.count({
        where: {
          status: "resolved",
        },
      }),
    ]);

    const totalReportsCount = reviewReportsCount + replyReportsCount;
    const totalPendingReportsCount =
      pendingReviewReportsCount + pendingReplyReportsCount;
    const totalResolvedReportsCount =
      resolvedReviewReportsCount + resolvedReplyReportsCount;

    return NextResponse.json(
      {
        ok: true,

        usersCount,
        reviewsCount,
        repliesCount,

        reviewReportsCount,
        replyReportsCount,
        totalReportsCount,

        pendingReviewReportsCount,
        pendingReplyReportsCount,
        totalPendingReportsCount,

        resolvedReviewReportsCount,
        resolvedReplyReportsCount,
        totalResolvedReportsCount,

        // aliases para no romper UI vieja si esperaba estos nombres
        reportsCount: totalReportsCount,
        pendingReportsCount: totalPendingReportsCount,
        resolvedReportsCount: totalResolvedReportsCount,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("admin stats GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}