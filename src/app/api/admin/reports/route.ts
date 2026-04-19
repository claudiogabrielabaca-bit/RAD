import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  resolved: 1,
  ignored: 2,
};

type ReportAuthor = {
  user?: { username: string } | null;
  anonId?: string | null;
};

type RatingAuthor = {
  user?: { username: string } | null;
  anonId?: string | null;
};

type AdminReportRecord = {
  id: string;
  ratingId: string;
  reason: string;
  status: string;
  anonId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { username: string } | null;
  rating: {
    id: string;
    day: string;
    stars: number;
    review: string;
    anonId: string | null;
    createdAt: Date;
    user: { username: string } | null;
  } | null;
};

type NormalizedReport = {
  id: string;
  ratingId: string;
  reason: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reportAuthorLabel: string;
  rating: {
    id: string;
    day: string;
    stars: number;
    review: string;
    authorLabel: string;
    createdAt: string;
  } | null;
};

function getReportAuthorLabel(report: ReportAuthor) {
  if (report.user?.username) return `@${report.user.username}`;
  if (report.anonId) return report.anonId;
  return "Unknown";
}

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

    const reports: AdminReportRecord[] = await prisma.reviewReport.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            username: true,
          },
        },
        rating: {
          include: {
            user: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });

    const normalized: NormalizedReport[] = reports
      .map((report: AdminReportRecord) => ({
        id: report.id,
        ratingId: report.ratingId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
        reportAuthorLabel: getReportAuthorLabel(report),
        rating: report.rating
          ? {
              id: report.rating.id,
              day: report.rating.day,
              stars: report.rating.stars,
              review: report.rating.review,
              authorLabel: getRatingAuthorLabel(report.rating),
              createdAt: report.rating.createdAt.toISOString(),
            }
          : null,
      }))
      .sort((a: NormalizedReport, b: NormalizedReport) => {
        const aPriority = STATUS_PRIORITY[a.status] ?? 999;
        const bPriority = STATUS_PRIORITY[b.status] ?? 999;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });

    return NextResponse.json(
      { reports: normalized },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("admin reports GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}