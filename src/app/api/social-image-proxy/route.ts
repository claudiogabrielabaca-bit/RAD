import { NextRequest, NextResponse } from "next/server";

const RETRYABLE_IMAGE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const SOCIAL_IMAGE_USER_AGENT =
  "RateAnyDay/1.0 (social image proxy; https://rateanyday.com)";

function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    return (
      url.hostname === "upload.wikimedia.org" ||
      url.hostname === "commons.wikimedia.org" ||
      url.hostname.endsWith(".wikimedia.org")
    );
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchImageWithRetry(imageUrl: string) {
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await sleep(220 * attempt);
    }

    try {
      const upstream = await fetch(imageUrl, {
        headers: {
          "User-Agent": SOCIAL_IMAGE_USER_AGENT,
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        cache: "force-cache",
        next: {
          revalidate: 60 * 60 * 24 * 7,
        },
      });

      lastResponse = upstream;

      if (upstream.ok || !RETRYABLE_IMAGE_STATUSES.has(upstream.status)) {
        return upstream;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError;
}

export async function GET(req: NextRequest) {
  const imageUrl = req.nextUrl.searchParams.get("url");

  if (!imageUrl || !isAllowedImageUrl(imageUrl)) {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }

  try {
    const upstream = await fetchImageWithRetry(imageUrl);

    if (!upstream.ok) {
      return NextResponse.json({ error: "Could not load image." }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "";

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "URL did not return an image." }, { status: 415 });
    }

    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not proxy image." }, { status: 502 });
  }
}
