import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { isValidDayString } from "@/app/lib/day";

function clampStars(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.floor(n)));
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to rate days." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
    }

    const { day, stars, review } = body as {
      day?: string;
      stars?: number;
      review?: string;
    };

    if (!isValidDayString(day)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }

    const s = clampStars(Number(stars));
    if (s < 1 || s > 5) {
      return NextResponse.json({ error: "Invalid stars" }, { status: 400 });
    }

    const text = (review ?? "").toString().trim();

    if (text.length > 280) {
      return NextResponse.json(
        { error: "Review too long (max 280)" },
        { status: 400 }
      );
    }

    await prisma.rating.upsert({
      where: {
        userId_day: {
          userId: user.id,
          day,
        },
      },
      update: {
        stars: s,
        review: text,
        anonId: null,
      },
      create: {
        userId: user.id,
        anonId: null,
        day,
        stars: s,
        review: text,
      },
    });

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("rate POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}