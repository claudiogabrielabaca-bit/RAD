import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type RatingAuthor = {
  user?: { username: string } | null;
  anonId?: string | null;
};

type RecentReviewRating = {
  id: string;
  day: string;
  stars: number;
  review: string;
  anonId: string | null;
  createdAt: Date;
  user: { username: string } | null;
  _count: {
    reports: number;
    replies: number;
    likes: number;
  };
};

type PendingReportCountRow = {
  ratingId: string;
  _count: {
    _all: number;
  };
};

function getRatingAuthorLabel(rating: RatingAuthor) {
  if (rating.user?.username) return `@${rating.user.username}`;
  if (rating.anonId) return rating.anonId;
  return "Unknown";
}

export async function GET() {
  try {
    const isAdmin = await isAdminAuthenticated();

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const ratings: RecentReviewRating[] = await prisma.rating.findMany({
      orderBy: { createdAt: "desc" },
      take: 24,
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

    const ratingIds = ratings.map((rating: RecentReviewRating) => rating.id);

    const pendingReportRows: PendingReportCountRow[] = ratingIds.length
      ? await prisma.reviewReport.groupBy({
          by: ["ratingId"],
          where: {
            ratingId: {
              in: ratingIds,
            },
            status: "pending",
          },
          _count: {
            _all: true,
          },
        })
      : [];

    const pendingReportsMap = new Map(
      pendingReportRows.map((row: PendingReportCountRow) => [
        row.ratingId,
        row._count._all,
      ])
    );

    const reviews = ratings.map((rating: RecentReviewRating) => ({
      id: rating.id,
      day: rating.day,
      stars: rating.stars,
      review: rating.review,
      authorLabel: getRatingAuthorLabel(rating),
      createdAt: rating.createdAt.toISOString(),
      reportsCount: rating._count.reports,
      pendingReportsCount: pendingReportsMap.get(rating.id) ?? 0,
      repliesCount: rating._count.replies,
      likesCount: rating._count.likes,
    }));

    return NextResponse.json(
      { reviews },
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
