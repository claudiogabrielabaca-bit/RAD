import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { Resend } from "resend";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const REPORT_REASON_MIN_LENGTH = 3;
const REPORT_REASON_MAX_LENGTH = 280;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to report a reply." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (user.emailVerified === false) {
      return NextResponse.json(
        { error: "You must verify your email to report a reply." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "reply-report",
      key: buildRateLimitKey(req, user.id),
      limit: 6,
      windowMs: 30 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many reply reports. Please try again later."
      );
    }

    const body = await req.json().catch(() => null);
    const replyId = body?.replyId;
    const reason = body?.reason;

    if (!replyId || typeof replyId !== "string") {
      return NextResponse.json(
        { error: "Invalid replyId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!reason || typeof reason !== "string") {
      return NextResponse.json(
        { error: "Invalid reason" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const trimmedReason = reason.trim();

    if (trimmedReason.length < REPORT_REASON_MIN_LENGTH) {
      return NextResponse.json(
        {
          error: `Reason must be at least ${REPORT_REASON_MIN_LENGTH} characters.`,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (trimmedReason.length > REPORT_REASON_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Reason is too long (max ${REPORT_REASON_MAX_LENGTH} chars).`,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const reply = await prisma.ratingReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        userId: true,
        ratingId: true,
        text: true,
        createdAt: true,
        rating: {
          select: {
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
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!reply) {
      return NextResponse.json(
        { error: "Reply not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (reply.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot report your own reply." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const reportWhere = {
      reply_report_user_unique: {
        replyId,
        userId: user.id,
      },
    } as const;

    const existingReport = await prisma.replyReport.findUnique({
      where: reportWhere,
      select: {
        id: true,
      },
    });

    const report = await prisma.replyReport.upsert({
      where: reportWhere,
      update: {
        reason: trimmedReason,
        status: "pending",
      },
      create: {
        replyId,
        userId: user.id,
        anonId: null,
        reason: trimmedReason,
        status: "pending",
      },
      select: {
        id: true,
        replyId: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const reportsToEmail = process.env.REPORTS_TO_EMAIL?.trim();

    if (resend && reportsToEmail) {
      await resend.emails.send({
        from: "RAD Reports <onboarding@resend.dev>",
        to: reportsToEmail,
        subject: `New reply report on RAD - ${escapeHtml(reply.rating.day)}`,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #111;">
            <h2>New reply report</h2>

            <p><strong>Day:</strong> ${escapeHtml(reply.rating.day)}</p>
            <p><strong>Reply ID:</strong> ${escapeHtml(reply.id)}</p>
            <p><strong>Review ID:</strong> ${escapeHtml(reply.ratingId)}</p>
            <p><strong>Report ID:</strong> ${escapeHtml(report.id)}</p>
            <p><strong>Reported by user:</strong> @${escapeHtml(user.username)} (${escapeHtml(user.email)})</p>
            <p><strong>Reply author:</strong> ${
              reply.user?.username
                ? `@${escapeHtml(reply.user.username)} (${escapeHtml(reply.user.email ?? "")})`
                : "Unknown user"
            }</p>
            <p><strong>Parent review author:</strong> ${
              reply.rating.user?.username
                ? `@${escapeHtml(reply.rating.user.username)}`
                : "Unknown user"
            }</p>
            <p><strong>Parent review stars:</strong> ${reply.rating.stars}/5</p>
            <p><strong>Reason:</strong> ${escapeHtml(trimmedReason)}</p>
            <p><strong>Status:</strong> ${escapeHtml(report.status)}</p>

            <p><strong>Reply text:</strong></p>
            <div style="padding: 12px; background: #f5f5f5; border-radius: 8px; border: 1px solid #ddd;">
              ${
                reply.text?.trim()
                  ? escapeHtml(reply.text).replace(/\n/g, "<br />")
                  : "<em>No reply text</em>"
              }
            </div>

            <p><strong>Parent review text:</strong></p>
            <div style="padding: 12px; background: #f5f5f5; border-radius: 8px; border: 1px solid #ddd;">
              ${
                reply.rating.review?.trim()
                  ? escapeHtml(reply.rating.review).replace(/\n/g, "<br />")
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
        alreadyReported: !!existingReport,
        message: existingReport ? "Report updated" : "Report received",
        report: {
          ...report,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
        },
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("reply-report POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}