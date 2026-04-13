import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getCurrentUser } from "@/app/lib/current-user";
import { isValidDayString } from "@/app/lib/day";

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

function isIpv4(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function isPrivateOrInvalidHost(hostname: string) {
  const host = hostname.toLowerCase();

  if (!host || host === "localhost" || host.endsWith(".local")) {
    return true;
  }

  if (isIpv4(host)) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  const pieces = host.split(".");
  const tld = pieces[pieces.length - 1];

  if (pieces.length < 2) return true;
  if (!tld || tld.length < 2) return true;

  return false;
}

function normalizeAndValidateSource(input?: string) {
  const raw = (input ?? "").trim();

  if (!raw) {
    return { ok: false as const, error: "Source is required." };
  }

  let value = raw;

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return { ok: false as const, error: "Source must be a valid public URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false as const, error: "Source must use http or https." };
  }

  if (isPrivateOrInvalidHost(parsed.hostname)) {
    return {
      ok: false as const,
      error: "Source must be a real public website.",
    };
  }

  return {
    ok: true as const,
    value: parsed.toString(),
  };
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to suggest an event." },
        { status: 401 }
      );
    }

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

    if (!isValidDayString(day)) {
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

    const validatedSource = normalizeAndValidateSource(source);

    if (!validatedSource.ok) {
      return NextResponse.json(
        { error: validatedSource.error },
        { status: 400 }
      );
    }

    const toEmail = process.env.SUGGESTIONS_TO_EMAIL?.trim();

    if (!toEmail) {
      return NextResponse.json(
        { error: "Suggestions inbox is not configured." },
        { status: 500 }
      );
    }

    const safeDay = escapeHtml(day);
    const safeEvent = escapeHtml(event.trim());
    const safeDescription = escapeHtml(description.trim());
    const safeSource = escapeHtml(validatedSource.value);
    const safeUserEmail = escapeHtml(user.email);
    const safeTypedEmail = escapeHtml((email ?? "").trim());

    await resend.emails.send({
      from: "Rate Any Day <onboarding@resend.dev>",
      to: toEmail,
      subject: `New historical suggestion for ${safeDay}`,
      html: `
        <h2>New historical suggestion</h2>
        <p><strong>Date:</strong> ${safeDay}</p>
        <p><strong>Event:</strong> ${safeEvent}</p>
        <p><strong>Description:</strong><br/>${safeDescription}</p>
        <p><strong>Source URL:</strong> ${safeSource}</p>
        <p><strong>Logged user email:</strong> ${safeUserEmail}</p>
        <p><strong>Typed email field:</strong> ${safeTypedEmail || "—"}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("suggest-event POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}