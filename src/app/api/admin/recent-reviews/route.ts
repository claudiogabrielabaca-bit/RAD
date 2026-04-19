import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  reports: Array<{ status: string }>;
  replies: Array<{ id: string }>;
  likes: Array<{ id: string }>;
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ratings: RecentReviewRating[] = await prisma.rating.findMany({
      orderBy: { createdAt: "desc" },
      take: 24,
      include: {
        user: {
          select: {
            username: true,
          },
        },
        reports: {
          select: {
            status: true,
          },
        },
        replies: {
          select: {
            id: true,
          },
        },
        likes: {
          select: {
            id: true,
          },
        },
      },
    });

    const reviews = ratings.map((rating: RecentReviewRating) => {
      const reportsCount = rating.reports.length;
      const pendingReportsCount = rating.reports.filter(
        (report: { status: string }) => report.status === "pending"
      ).length;

      return {
        id: rating.id,
        day: rating.day,
        stars: rating.stars,
        review: rating.review,
        authorLabel: getRatingAuthorLabel(rating),
        createdAt: rating.createdAt.toISOString(),
        reportsCount,
        pendingReportsCount,
        repliesCount: rating.replies.length,
        likesCount: rating.likes.length,
      };
    });

    return NextResponse.json(
      { reviews },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("admin recent-reviews GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}