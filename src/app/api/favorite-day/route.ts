import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { isValidDayString } from "@/app/lib/day";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to use favorite days." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dayParam = searchParams.get("day");

    if (!isValidDayString(dayParam)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }

    const favorite = await prisma.favoriteDay.findFirst({
      where: {
        userId: user.id,
        day: dayParam,
      },
      select: {
        day: true,
      },
    });

    return NextResponse.json(
      {
        day: dayParam,
        isFavorite: !!favorite,
        favoriteDay: favorite?.day ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("favorite-day GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to save favorite days." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const day = body?.day;

    if (!isValidDayString(day)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }

    const existing = await prisma.favoriteDay.findFirst({
      where: {
        userId: user.id,
        day,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await prisma.favoriteDay.delete({
        where: { id: existing.id },
      });

      return NextResponse.json(
        {
          ok: true,
          isFavorite: false,
          favoriteDay: null,
          message: "Removed from favorites.",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const created = await prisma.favoriteDay.create({
      data: {
        userId: user.id,
        anonId: null,
        day,
      },
      select: {
        day: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        isFavorite: true,
        favoriteDay: created.day,
        message: "Favorite day saved.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("favorite-day POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}