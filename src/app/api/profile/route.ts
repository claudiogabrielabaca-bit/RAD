import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const [ratings, favoriteDays] = await Promise.all([
      prisma.rating.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          day: true,
          stars: true,
          review: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.favoriteDay.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          day: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const stats = {
      ratingsCount: ratings.length,
      favoritesCount: favoriteDays.length,
      averageRating:
        ratings.length > 0
          ? ratings.reduce((acc, item) => acc + item.stars, 0) / ratings.length
          : 0,
    };

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt.toISOString(),
        },
        ratings: ratings.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        favoriteDays: favoriteDays.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        stats,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("profile GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}