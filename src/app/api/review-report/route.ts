import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getOrCreateAnonId } from "@/app/lib/anon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const anonId = await getOrCreateAnonId();
    const body = await req.json().catch(() => null);

    const ratingId = body?.ratingId;
    const reason = body?.reason;

    if (!ratingId || typeof ratingId !== "string") {
      return NextResponse.json({ error: "Invalid ratingId" }, { status: 400 });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    const rating = await prisma.rating.findUnique({
      where: { id: ratingId },
      select: {
        id: true,
        anonId: true,
        day: true,
      },
    });

    if (!rating) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (rating.anonId === anonId) {
      return NextResponse.json(
        { error: "You cannot report your own review" },
        { status: 400 }
      );
    }

    const existingReport = await prisma.reviewReport.findFirst({
      where: {
        ratingId,
        anonId,
      },
      select: {
        id: true,
      },
    });

    let report;

    if (existingReport) {
      report = await prisma.reviewReport.update({
        where: { id: existingReport.id },
        data: {
          reason: reason.trim(),
          status: "pending",
        },
        select: {
          id: true,
          ratingId: true,
          reason: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      report = await prisma.reviewReport.create({
        data: {
          ratingId,
          anonId,
          reason: reason.trim(),
          status: "pending",
        },
        select: {
          id: true,
          ratingId: true,
          reason: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: existingReport ? "Report updated" : "Report received",
        day: rating.day,
        report: {
          ...report,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("review-report POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}