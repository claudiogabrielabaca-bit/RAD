import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
    }

    const {
      day,
      event,
      description,
      source,
      email,
      website,
    } = body as {
      day?: string;
      event?: string;
      description?: string;
      source?: string;
      email?: string;
      website?: string;
    };

    if (website && website.trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }

    if (!event || event.trim().length < 5) {
      return NextResponse.json({ error: "Event too short" }, { status: 400 });
    }

    if (!description || description.trim().length < 10) {
      return NextResponse.json(
        { error: "Description too short" },
        { status: 400 }
      );
    }

    const safeDay = escapeHtml(day);
    const safeEvent = escapeHtml(event.trim());
    const safeDescription = escapeHtml(description.trim());
    const safeSource = escapeHtml((source ?? "").trim());
    const safeEmail = escapeHtml((email ?? "").trim());

    await resend.emails.send({
      from: "Rate Any Day <onboarding@resend.dev>",
      to: process.env.SUGGESTIONS_TO_EMAIL || "",
      subject: `New historical suggestion for ${safeDay}`,
      html: `
        <h2>New historical suggestion</h2>
        <p><strong>Date:</strong> ${safeDay}</p>
        <p><strong>Event:</strong> ${safeEvent}</p>
        <p><strong>Description:</strong><br/>${safeDescription}</p>
        <p><strong>Source:</strong> ${safeSource || "—"}</p>
        <p><strong>User email:</strong> ${safeEmail || "—"}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("suggest-event POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}