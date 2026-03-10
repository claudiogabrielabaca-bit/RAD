import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const isAdmin = await isAdminAuthenticated();

    if (!isAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const reports = await prisma.reviewReport.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        rating: true,
      },
    });

    return NextResponse.json(
      {
        reports: reports.map((report) => ({
          id: report.id,
          ratingId: report.ratingId,
          anonId: report.anonId,
          reason: report.reason,
          status: report.status,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
          rating: report.rating
            ? {
                id: report.rating.id,
                day: report.rating.day,
                stars: report.rating.stars,
                review: report.rating.review,
                anonId: report.rating.anonId,
                createdAt: report.rating.createdAt.toISOString(),
              }
            : null,
        })),
      },
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