import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const MAX_REPORT_ID_LENGTH = 80;

function isAllowedStatus(value: string) {
  return value === "pending" || value === "resolved" || value === "dismissed";
}

export async function POST(req: Request) {
  try {
    const adminSession = await requireAdminSession();

    if (!adminSession) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => null);

    const reportId =
      typeof body?.reportId === "string"
        ? body.reportId.trim()
        : typeof body?.id === "string"
          ? body.id.trim()
          : "";

    const reportType =
      body?.reportType === "review" || body?.reportType === "reply"
        ? body.reportType
        : null;

    const requestedStatus =
      typeof body?.status === "string" ? body.status.trim() : "";

    const status = isAllowedStatus(requestedStatus)
      ? requestedStatus
      : "resolved";

    if (!reportId || reportId.length > MAX_REPORT_ID_LENGTH) {
      return NextResponse.json(
        { error: "Invalid reportId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (reportType === "review") {
      const existing = await prisma.reviewReport.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          status: true,
          ratingId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Review report not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      const updated = await prisma.reviewReport.update({
        where: { id: reportId },
        data: { status },
        select: {
          id: true,
          status: true,
          ratingId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          reportType: "review",
          report: {
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          },
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    if (reportType === "reply") {
      const existing = await prisma.replyReport.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          status: true,
          replyId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Reply report not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      const updated = await prisma.replyReport.update({
        where: { id: reportId },
        data: { status },
        select: {
          id: true,
          status: true,
          replyId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          reportType: "reply",
          report: {
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          },
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const existingReviewReport = await prisma.reviewReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
      },
    });

    if (existingReviewReport) {
      const updated = await prisma.reviewReport.update({
        where: { id: reportId },
        data: { status },
        select: {
          id: true,
          status: true,
          ratingId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          reportType: "review",
          report: {
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          },
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const existingReplyReport = await prisma.replyReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
      },
    });

    if (existingReplyReport) {
      const updated = await prisma.replyReport.update({
        where: { id: reportId },
        data: { status },
        select: {
          id: true,
          status: true,
          replyId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          reportType: "reply",
          report: {
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          },
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    return NextResponse.json(
      { error: "Report not found" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("admin report-resolve POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
