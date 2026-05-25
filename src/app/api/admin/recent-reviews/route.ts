import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/lib/admin";
import { formatAdminUserLabel } from "@/app/lib/admin-control-room";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const RECENT_REVIEWS_LIMIT = 24;

type RecentReviewRating = {
  id: string;
  day: string;
  stars: number;
  review: string;
  anonId: string | null;
  createdAt: Date;
  user: { username: string; email: string } | null;
  _count: {
    reports: number;
    replies: number;
    likes: number;
  };
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

    const ratings: RecentReviewRating[] = await prisma.rating.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_REVIEWS_LIMIT,
      select: {
        id: true,
        day: true,
        stars: true,
        review: true,
        anonId: true,
        createdAt: true,
        user: {
          select: {
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            reports: true,
            replies: true,
            likes: true,
          },
        },
      },
    });

    const ratingIds = ratings.map((rating) => rating.id);

    const pendingReportRows: Array<{ ratingId: string }> = ratingIds.length
      ? await prisma.reviewReport.findMany({
          where: {
            ratingId: {
              in: ratingIds,
            },
            status: "pending",
          },
          select: {
            ratingId: true,
          },
        })
      : [];

    const pendingReportsMap = new Map<string, number>();

    for (const row of pendingReportRows) {
      pendingReportsMap.set(
        row.ratingId,
        (pendingReportsMap.get(row.ratingId) ?? 0) + 1
      );
    }

    const reviews = ratings.map((rating) => ({
      id: rating.id,
      day: rating.day,
      stars: rating.stars,
      review: rating.review,
      authorLabel: formatAdminUserLabel({
        username: rating.user?.username,
        email: rating.user?.email,
        fallback: rating.anonId ?? "Anonymous",
      }),
      createdAt: rating.createdAt.toISOString(),
      reportsCount: rating._count.reports,
      pendingReportsCount: pendingReportsMap.get(rating.id) ?? 0,
      repliesCount: rating._count.replies,
      likesCount: rating._count.likes,
    }));

    return NextResponse.json(
      {
        ok: true,
        reviews,
        items: reviews,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("admin recent-reviews GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
