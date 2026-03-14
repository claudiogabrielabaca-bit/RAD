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

function getReportAuthorLabel(report: {
  user?: { username: string } | null;
  anonId?: string | null;
}) {
  if (report.user?.username) return `@${report.user.username}`;
  if (report.anonId) return report.anonId;
  return "Unknown";
}

function getRatingAuthorLabel(rating: {
  user?: { username: string } | null;
  anonId?: string | null;
}) {
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

    const reports = await prisma.reviewReport.findMany({
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

    const normalized = reports
      .map((report) => ({
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
      .sort((a, b) => {
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
