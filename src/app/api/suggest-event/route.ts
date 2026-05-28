import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { isValidDayString } from "@/app/lib/day";
import { sendMail } from "@/app/lib/mail";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitResponse,
} from "@/app/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const EVENT_MAX_LENGTH = 180;
const DESCRIPTION_MAX_LENGTH = 1200;
const SOURCE_MAX_LENGTH = 2048;
const TYPED_EMAIL_MAX_LENGTH = 254;
const HONEYPOT_MAX_LENGTH = 200;

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
    return { ok: false as const, error: "Source is too long." };
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
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (user.emailVerified === false) {
      return NextResponse.json(
        { error: "You must verify your email to suggest an event." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "suggest-event",
      key: buildRateLimitKey(req, user.id),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many suggestions. Please try again later."
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Bad JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
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

    if (typeof website === "string" && website.length > HONEYPOT_MAX_LENGTH) {
      return NextResponse.json(
        { ok: true },
        { headers: NO_STORE_HEADERS }
      );
    }

    if (website && website.trim() !== "") {
      return NextResponse.json(
        { ok: true },
        { headers: NO_STORE_HEADERS }
      );
    }

    if (!isValidDayString(day)) {
      return NextResponse.json(
        { error: "Invalid day" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const normalizedEvent = event?.trim() ?? "";
    const normalizedDescription = description?.trim() ?? "";
    const normalizedTypedEmail = email?.trim() ?? "";

    if (normalizedEvent.length < 5) {
      return NextResponse.json(
        { error: "Event too short" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (normalizedEvent.length > EVENT_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Event is too long. Max ${EVENT_MAX_LENGTH} chars.` },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (normalizedDescription.length < 10) {
      return NextResponse.json(
        { error: "Description too short" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (normalizedDescription.length > DESCRIPTION_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: `Description is too long. Max ${DESCRIPTION_MAX_LENGTH} chars.`,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (normalizedTypedEmail.length > TYPED_EMAIL_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Email is too long. Max ${TYPED_EMAIL_MAX_LENGTH} chars.` },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const validatedSource = normalizeAndValidateSource(source);

    if (!validatedSource.ok) {
      return NextResponse.json(
        { error: validatedSource.error },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const toEmail = process.env.SUGGESTIONS_TO_EMAIL?.trim();

    if (!toEmail) {
      return NextResponse.json(
        { error: "Suggestions inbox is not configured." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const safeDay = escapeHtml(day);
    const safeEvent = escapeHtml(normalizedEvent);
    const safeDescription = escapeHtml(normalizedDescription);
    const safeSource = escapeHtml(validatedSource.value);
    const safeUserEmail = escapeHtml(user.email);
    const safeUsername = escapeHtml(user.username);
    const safeTypedEmail = escapeHtml(normalizedTypedEmail);

    try {
      const mailResult = await sendMail({
        to: toEmail,
        subject: `New historical suggestion for ${safeDay}`,
        text: [
          "New historical suggestion",
          `Day: ${day}`,
          `Event: ${normalizedEvent}`,
          `Description: ${normalizedDescription}`,
          `Source URL: ${validatedSource.value}`,
          `Logged user: @${user.username}`,
          `Logged user email: ${user.email}`,
          `Typed email field: ${normalizedTypedEmail || "—"}`,
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2>New historical suggestion</h2>
            <p><strong>Date:</strong> ${safeDay}</p>
            <p><strong>Event:</strong> ${safeEvent}</p>
            <p><strong>Description:</strong><br/>${safeDescription.replace(/\n/g, "<br/>")}</p>
            <p><strong>Source URL:</strong> ${safeSource}</p>
            <p><strong>Logged user:</strong> @${safeUsername}</p>
            <p><strong>Logged user email:</strong> ${safeUserEmail}</p>
            <p><strong>Typed email field:</strong> ${safeTypedEmail || "—"}</p>
          </div>
        `,
      });

      if (process.env.NODE_ENV === "development") {
          console.log("suggest-event email sent:", mailResult?.id);
        }
    } catch (mailError) {
      console.error("suggest-event mail send error:", mailError);

      return NextResponse.json(
        { error: "Could not send suggestion email." },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("suggest-event POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
