import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const resend = new Resend(process.env.RESEND_API_KEY);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to report a bug." },
        { status: 401 }
      );
    }

    const formData = await req.formData().catch(() => null);

    if (!formData) {
      return NextResponse.json({ error: "Bad form data." }, { status: 400 });
    }

    const description = normalizeText(formData.get("description"));
    const pagePath = normalizeText(formData.get("pagePath"));
    const pageUrl = normalizeText(formData.get("pageUrl"));
    const userAgent = normalizeText(formData.get("userAgent"));
    const screenshotEntry = formData.get("screenshot");

    if (description.length < 10) {
      return NextResponse.json(
        { error: "Bug description is too short." },
        { status: 400 }
      );
    }

    let attachment:
      | {
          filename: string;
          content: Buffer;
        }
      | undefined;

    if (screenshotEntry instanceof File && screenshotEntry.size > 0) {
      if (!screenshotEntry.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Screenshot must be an image." },
          { status: 400 }
        );
      }

      if (screenshotEntry.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "Screenshot is too large. Max 5 MB." },
          { status: 400 }
        );
      }

      const bytes = await screenshotEntry.arrayBuffer();
      attachment = {
        filename: screenshotEntry.name || "bug-screenshot",
        content: Buffer.from(bytes),
      };
    }

    const toEmail =
      process.env.BUG_REPORTS_TO_EMAIL?.trim() ||
      process.env.SUGGESTIONS_TO_EMAIL?.trim();

    if (!toEmail) {
      return NextResponse.json(
        { error: "Bug report inbox is not configured." },
        { status: 500 }
      );
    }

    const from = process.env.MAIL_FROM?.trim() || "Rate Any Day <onboarding@resend.dev>";

    const safeDescription = escapeHtml(description);
    const safePagePath = escapeHtml(pagePath || "—");
    const safePageUrl = escapeHtml(pageUrl || "—");
    const safeUserAgent = escapeHtml(userAgent || "—");
    const safeUserEmail = escapeHtml(user.email);
    const safeUsername = escapeHtml(user.username);

    const result = await resend.emails.send({
      from,
      to: toEmail,
      subject: `🐞 Bug report from @${safeUsername}`,
      html: `
        <h2>New bug report</h2>
        <p><strong>User:</strong> @${safeUsername}</p>
        <p><strong>Email:</strong> ${safeUserEmail}</p>
        <p><strong>Path:</strong> ${safePagePath}</p>
        <p><strong>Full URL:</strong> ${safePageUrl}</p>
        <p><strong>User agent:</strong> ${safeUserAgent}</p>
        <p><strong>Description:</strong></p>
        <p>${safeDescription.replace(/\n/g, "<br/>")}</p>
      `,
      text: [
        "New bug report",
        `User: @${user.username}`,
        `Email: ${user.email}`,
        `Path: ${pagePath || "—"}`,
        `Full URL: ${pageUrl || "—"}`,
        `User agent: ${userAgent || "—"}`,
        "",
        "Description:",
        description,
      ].join("\n"),
      attachments: attachment ? [attachment] : undefined,
    });

    if (result.error) {
      console.error("report-bug POST resend error:", result.error);
      return NextResponse.json({ error: "Could not send bug report." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("report-bug POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}