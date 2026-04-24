import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type AdminReportItem = {
  id: string;
  reportType: "review" | "reply";
  status: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
  day: string;
  ratingId: string;
  replyId: string | null;
  reviewStars: number | null;
  reviewText: string | null;
  replyText: string | null;
  reportedBy: string | null;
  reportedByEmail: string | null;
  targetAuthor: string | null;
  targetAuthorEmail: string | null;
  parentReviewAuthor: string | null;
  parentReviewAuthorEmail: string | null;
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

    const [reviewReports, replyReports] = await Promise.all([
      prisma.reviewReport.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
        include: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
          rating: {
            select: {
              id: true,
              day: true,
              stars: true,
              review: true,
              user: {
                select: {
                  username: true,
                  email: true,
                },
              },
            },
          },
        },
      }),

      prisma.replyReport.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
        include: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
          reply: {
            select: {
              id: true,
              ratingId: true,
              text: true,
              user: {
                select: {
                  username: true,
                  email: true,
                },
              },
              rating: {
                select: {
                  id: true,
                  day: true,
                  stars: true,
                  review: true,
                  user: {
                    select: {
                      username: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const mappedReviewReports: AdminReportItem[] = reviewReports.map((item) => ({
      id: item.id,
      reportType: "review",
      status: item.status,
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      day: item.rating.day,
      ratingId: item.rating.id,
      replyId: null,
      reviewStars: item.rating.stars,
      reviewText: item.rating.review,
      replyText: null,
      reportedBy: item.user?.username ?? null,
      reportedByEmail: item.user?.email ?? null,
      targetAuthor: item.rating.user?.username ?? null,
      targetAuthorEmail: item.rating.user?.email ?? null,
      parentReviewAuthor: item.rating.user?.username ?? null,
      parentReviewAuthorEmail: item.rating.user?.email ?? null,
    }));

    const mappedReplyReports: AdminReportItem[] = replyReports.map((item) => ({
      id: item.id,
      reportType: "reply",
      status: item.status,
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      day: item.reply.rating.day,
      ratingId: item.reply.rating.id,
      replyId: item.reply.id,
      reviewStars: item.reply.rating.stars,
      reviewText: item.reply.rating.review,
      replyText: item.reply.text,
      reportedBy: item.user?.username ?? null,
      reportedByEmail: item.user?.email ?? null,
      targetAuthor: item.reply.user?.username ?? null,
      targetAuthorEmail: item.reply.user?.email ?? null,
      parentReviewAuthor: item.reply.rating.user?.username ?? null,
      parentReviewAuthorEmail: item.reply.rating.user?.email ?? null,
    }));

    const items = [...mappedReviewReports, ...mappedReplyReports].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(
      {
        ok: true,
        items,
        reports: items,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("admin reports GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}