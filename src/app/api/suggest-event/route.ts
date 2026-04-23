import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getCurrentUser } from "@/app/lib/current-user";
import { isValidDayString } from "@/app/lib/day";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EVENT_MIN_LENGTH = 5;
const EVENT_MAX_LENGTH = 160;
const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 2000;
const SOURCE_MAX_LENGTH = 2048;
const EMAIL_MAX_LENGTH = 320;

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

  if (raw.length > SOURCE_MAX_LENGTH) {
    return {
      ok: false as const,
      error: `Source is too long (max ${SOURCE_MAX_LENGTH} chars).`,
    };
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

    if (user.emailVerified === false) {
      return NextResponse.json(
        { error: "You must verify your email to suggest an event." },
        { status: 403 }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "suggest-event",
      key: buildRateLimitKey(req, user.id),
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many event suggestions. Please try again later."
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

    const trimmedEvent = (event ?? "").trim();
    const trimmedDescription = (description ?? "").trim();
    const trimmedTypedEmail = (email ?? "").trim();

    if (trimmedEvent.length < EVENT_MIN_LENGTH) {
      return NextResponse.json({ error: "Event too short" }, { status: 400 });
    }

    if (trimmedEvent.length > EVENT_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Event is too long (max ${EVENT_MAX_LENGTH} chars)` },
        { status: 400 }
      );
    }

    if (trimmedDescription.length < DESCRIPTION_MIN_LENGTH) {
      return NextResponse.json(
        { error: "Description too short" },
        { status: 400 }
      );
    }

    if (trimmedDescription.length > DESCRIPTION_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Description is too long (max ${DESCRIPTION_MAX_LENGTH} chars)`,
        },
        { status: 400 }
      );
    }

    if (trimmedTypedEmail.length > EMAIL_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Email is too long (max ${EMAIL_MAX_LENGTH} chars)` },
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
    const safeEvent = escapeHtml(trimmedEvent);
    const safeDescription = escapeHtml(trimmedDescription);
    const safeSource = escapeHtml(validatedSource.value);
    const safeUserEmail = escapeHtml(user.email);
    const safeTypedEmail = escapeHtml(trimmedTypedEmail);

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