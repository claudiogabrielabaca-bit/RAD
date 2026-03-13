import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to report a review." },
        { status: 401 }
      );
    }

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
        userId: true,
        day: true,
        stars: true,
        review: true,
        createdAt: true,
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!rating) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (rating.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot report your own review" },
        { status: 400 }
      );
    }

    const existingReport = await prisma.reviewReport.findFirst({
      where: {
        ratingId,
        userId: user.id,
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
          userId: user.id,
          anonId: null,
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

    const reportsToEmail = process.env.REPORTS_TO_EMAIL;

    if (resend && reportsToEmail) {
      await resend.emails.send({
        from: "RAD Reports <onboarding@resend.dev>",
        to: reportsToEmail,
        subject: `New review report on RAD - ${rating.day}`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #111;">
            <h2>New review report</h2>

            <p><strong>Day:</strong> ${rating.day}</p>
            <p><strong>Rating ID:</strong> ${rating.id}</p>
            <p><strong>Report ID:</strong> ${report.id}</p>
            <p><strong>Reported by user:</strong> @${user.username} (${user.email})</p>
            <p><strong>Review author:</strong> ${rating.user?.username ? `@${rating.user.username}` : "Unknown user"}</p>
            <p><strong>Stars:</strong> ${rating.stars}/5</p>
            <p><strong>Reason:</strong> ${reason.trim()}</p>
            <p><strong>Status:</strong> ${report.status}</p>

            <p><strong>Review text:</strong></p>
            <div style="padding: 12px; background: #f5f5f5; border-radius: 8px; border: 1px solid #ddd;">
              ${
                rating.review?.trim()
                  ? rating.review
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/\n/g, "<br />")
                  : "<em>No written review</em>"
              }
            </div>
          </div>
        `,
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