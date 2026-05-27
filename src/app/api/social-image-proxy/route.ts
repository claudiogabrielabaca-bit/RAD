import { NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  const imageUrl = req.nextUrl.searchParams.get("url");

  if (!imageUrl || !isAllowedImageUrl(imageUrl)) {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: {
        "User-Agent": "RAD social image proxy",
      },
      cache: "force-cache",
      next: {
        revalidate: 60 * 60 * 24 * 7,
      },
    });

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
