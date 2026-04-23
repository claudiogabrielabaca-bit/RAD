import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";
import { isValidDayString } from "@/app/lib/day";
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

type PrismaErrorWithCode = {
  code: string;
};

function isPrismaError(
  error: unknown,
  code: "P2002" | "P2025"
): error is PrismaErrorWithCode {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === code
  );
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to use favorite days." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const dayParam = searchParams.get("day");

    if (!isValidDayString(dayParam)) {
      return NextResponse.json(
        { error: "Invalid day" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const favorite = await prisma.favoriteDay.findUnique({
      where: {
        favorite_day_user_unique: {
          userId: user.id,
          day: dayParam,
        },
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
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("favorite-day GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to save favorite days." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (user.emailVerified === false) {
      return NextResponse.json(
        { error: "You must verify your email to save favorite days." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rateLimit = await consumeRateLimit({
      action: "favorite-day",
      key: buildRateLimitKey(req, user.id),
      limit: 40,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.ok) {
      return createRateLimitResponse(
        rateLimit.retryAfterSec,
        "Too many favorite day changes. Please try again later."
      );
    }

    const body = await req.json().catch(() => null);
    const day = body?.day;
    const desiredFavorite =
      typeof body?.isFavorite === "boolean" ? body.isFavorite : null;

    if (!isValidDayString(day)) {
      return NextResponse.json(
        { error: "Invalid day" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const favoriteWhere = {
      favorite_day_user_unique: {
        userId: user.id,
        day,
      },
    } as const;

    const existing = await prisma.favoriteDay.findUnique({
      where: favoriteWhere,
      select: {
        id: true,
      },
    });

    const shouldFavorite =
      desiredFavorite === null ? !existing : desiredFavorite;

    if (shouldFavorite) {
      if (!existing) {
        try {
          await prisma.favoriteDay.create({
            data: {
              userId: user.id,
              anonId: null,
              day,
            },
          });
        } catch (error) {
          if (!isPrismaError(error, "P2002")) {
            throw error;
          }
        }
      }
    } else if (existing) {
      try {
        await prisma.favoriteDay.delete({
          where: favoriteWhere,
        });
      } catch (error) {
        if (!isPrismaError(error, "P2025")) {
          throw error;
        }
      }
    }

    const favorite = await prisma.favoriteDay.findUnique({
      where: favoriteWhere,
      select: {
        day: true,
      },
    });

    const isFavorite = !!favorite;

    return NextResponse.json(
      {
        ok: true,
        isFavorite,
        favoriteDay: favorite?.day ?? null,
        message: isFavorite
          ? "Favorite day saved."
          : "Removed from favorites.",
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("favorite-day POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}