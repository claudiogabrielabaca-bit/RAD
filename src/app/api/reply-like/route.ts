import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";

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

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to like reviews." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => null);
    const ratingId = body?.ratingId;
    const desiredLiked =
      typeof body?.liked === "boolean" ? body.liked : null;

    if (!ratingId || typeof ratingId !== "string") {
      return NextResponse.json(
        { error: "Missing ratingId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const review = await prisma.rating.findUnique({
      where: { id: ratingId },
      select: {
        id: true,
        userId: true,
        day: true,
      },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (review.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot like your own review." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const likeWhere = {
      rating_like_user_unique: {
        ratingId,
        userId: user.id,
      },
    } as const;

    const existingLike = await prisma.ratingLike.findUnique({
      where: likeWhere,
      select: {
        id: true,
      },
    });

    const shouldLike =
      desiredLiked === null ? !existingLike : desiredLiked;

    if (shouldLike) {
      if (!existingLike) {
        try {
          const ops: Prisma.PrismaPromise<unknown>[] = [
            prisma.ratingLike.create({
              data: {
                ratingId,
                userId: user.id,
                anonId: null,
              },
            }),
          ];

          if (review.userId && review.userId !== user.id) {
            ops.push(
              prisma.notification.create({
                data: {
                  userId: review.userId,
                  actorUserId: user.id,
                  type: "review_liked",
                  reviewId: ratingId,
                  day: review.day,
                },
              })
            );
          }

          await prisma.$transaction(ops);
        } catch (error) {
          if (!isPrismaError(error, "P2002")) {
            throw error;
          }
        }
      }

      const likesCount = await prisma.ratingLike.count({
        where: { ratingId },
      });

      return NextResponse.json(
        {
          ok: true,
          liked: true,
          likesCount,
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    if (existingLike) {
      try {
        const ops: Prisma.PrismaPromise<unknown>[] = [
          prisma.ratingLike.delete({
            where: likeWhere,
          }),
        ];

        if (review.userId) {
          ops.push(
            prisma.notification.deleteMany({
              where: {
                type: "review_liked",
                userId: review.userId,
                actorUserId: user.id,
                reviewId: ratingId,
              },
            })
          );
        }

        await prisma.$transaction(ops);
      } catch (error) {
        if (!isPrismaError(error, "P2025")) {
          throw error;
        }
      }
    }

    const likesCount = await prisma.ratingLike.count({
      where: { ratingId },
    });

    return NextResponse.json(
      {
        ok: true,
        liked: false,
        likesCount,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("review-like POST error:", error);
    return NextResponse.json(
      {
        error: "Server error",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}