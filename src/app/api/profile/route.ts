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

    const favoriteDaysList = favoriteDays.map((item) => item.day);

    const favoriteDayPreviews = favoriteDaysList.length
      ? await prisma.dayHighlightCache.findMany({
          where: {
            day: {
              in: favoriteDaysList,
            },
          },
          select: {
            day: true,
            type: true,
            year: true,
            title: true,
            text: true,
            image: true,
            articleUrl: true,
          },
        })
      : [];

    const previewMap = new Map(
      favoriteDayPreviews.map((item) => [item.day, item])
    );

    const ratingsCount = ratings.length;
    const favoritesCount = favoriteDays.length;
    const averageRating =
      ratingsCount > 0
        ? ratings.reduce((acc, item) => acc + item.stars, 0) / ratingsCount
        : 0;

    const starDistribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: ratings.filter((item) => item.stars === stars).length,
    }));

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt.toISOString(),
        },
        ratings: ratings.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        latestRatings: ratings.slice(0, 5).map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        favoriteDays: favoriteDays.map((item) => {
          const preview = previewMap.get(item.day);

          return {
            ...item,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
            preview: preview
              ? {
                  type: preview.type,
                  year: preview.year,
                  title: preview.title,
                  text: preview.text,
                  image: preview.image,
                  articleUrl: preview.articleUrl,
                }
              : null,
          };
        }),
        stats: {
          ratingsCount,
          favoritesCount,
          averageRating,
          starDistribution,
        },
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
