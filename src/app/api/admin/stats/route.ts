import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/lib/admin";
import {
  type AdminStatsPayload,
  LEGACY_DISMISSED_REPORT_STATUSES,
} from "@/app/lib/admin-control-room";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function getUtcTodayStart() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export async function GET() {
  try {
    const adminSession = await requireAdminSession();

    if (!adminSession) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const todayStart = getUtcTodayStart();

    const [
      usersCount,
      reviewsCount,
      repliesCount,
      reviewReportsCount,
      replyReportsCount,
      pendingReviewReportsCount,
      resolvedReviewReportsCount,
      dismissedReviewReportsCount,
      pendingReplyReportsCount,
      resolvedReplyReportsCount,
      dismissedReplyReportsCount,
      reviewsToday,
      reviewReportsToday,
      replyReportsToday,
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
      prisma.reviewReport.count({
        where: {
          status: {
            in: LEGACY_DISMISSED_REPORT_STATUSES,
          },
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
      prisma.replyReport.count({
        where: {
          status: {
            in: LEGACY_DISMISSED_REPORT_STATUSES,
          },
        },
      }),
      prisma.rating.count({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
      }),
      prisma.reviewReport.count({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
      }),
      prisma.replyReport.count({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
      }),
    ]);

    const totalReportsCount = reviewReportsCount + replyReportsCount;
    const totalPendingReportsCount =
      pendingReviewReportsCount + pendingReplyReportsCount;
    const totalResolvedReportsCount =
      resolvedReviewReportsCount + resolvedReplyReportsCount;
    const totalDismissedReportsCount =
      dismissedReviewReportsCount + dismissedReplyReportsCount;
    const reportsToday = reviewReportsToday + replyReportsToday;

    const stats: AdminStatsPayload = {
      generatedAt: new Date().toISOString(),

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

      dismissedReviewReportsCount,
      dismissedReplyReportsCount,
      totalDismissedReportsCount,

      reviewsToday,
      reportsToday,

      totalUsers: usersCount,
      totalReviews: reviewsCount,
      totalReplies: repliesCount,
      totalReports: totalReportsCount,
      pendingReports: totalPendingReportsCount,
      resolvedReports: totalResolvedReportsCount,
      dismissedReports: totalDismissedReportsCount,
      ignoredReports: totalDismissedReportsCount,
      reportsCount: totalReportsCount,
      pendingReportsCount: totalPendingReportsCount,
      resolvedReportsCount: totalResolvedReportsCount,
    };

    return NextResponse.json(
      {
        ok: true,
        stats,
        ...stats,
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
