import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_STATUSES = new Set(["pending", "resolved", "ignored"]);

export async function POST(req: Request) {
  try {
    const isAdmin = await isAdminAuthenticated();

    if (!isAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const reportId = body?.reportId;
    const status = body?.status;

    if (!reportId || typeof reportId !== "string") {
      return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
    }

    if (!status || typeof status !== "string" || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const existing = await prisma.reviewReport.findUnique({
      where: { id: reportId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const updated = await prisma.reviewReport.update({
      where: { id: reportId },
      data: { status },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        report: {
          ...updated,
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("admin report-resolve POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
