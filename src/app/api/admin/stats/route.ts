import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET() {
  try {
    const isAdmin = await isAdminAuthenticated();

    if (!isAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const today = startOfToday();

    const [
      totalReports,
      pendingReports,
      resolvedReports,
      ignoredReports,
      totalUsers,
      totalReviews,
      reviewsToday,
      reportsToday,
    ] = await Promise.all([
      prisma.reviewReport.count(),
      prisma.reviewReport.count({
        where: { status: "pending" },
      }),
      prisma.reviewReport.count({
        where: { status: "resolved" },
      }),
      prisma.reviewReport.count({
        where: { status: "ignored" },
      }),
      prisma.user.count(),
      prisma.rating.count(),
      prisma.rating.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      }),
      prisma.reviewReport.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      }),
    ]);

    return NextResponse.json(
      {
        stats: {
          totalReports,
          pendingReports,
          resolvedReports,
          ignoredReports,
          totalUsers,
          totalReviews,
          reviewsToday,
          reportsToday,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("admin stats GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
