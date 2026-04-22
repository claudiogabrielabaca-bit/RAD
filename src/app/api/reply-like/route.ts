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
        { error: "You must be logged in to like replies." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => null);
    const replyId = body?.replyId;
    const desiredLiked =
      typeof body?.liked === "boolean" ? body.liked : null;

    if (!replyId || typeof replyId !== "string") {
      return NextResponse.json(
        { error: "Missing replyId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const reply = await prisma.ratingReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        userId: true,
        ratingId: true,
        rating: {
          select: {
            day: true,
          },
        },
      },
    });

    if (!reply) {
      return NextResponse.json(
        { error: "Reply not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (reply.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot like your own reply." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const likeWhere = {
      reply_like_user_unique: {
        replyId,
        userId: user.id,
      },
    } as const;

    const existingLike = await prisma.replyLike.findUnique({
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
            prisma.replyLike.create({
              data: {
                replyId,
                userId: user.id,
                anonId: null,
              },
            }),
          ];

          if (reply.userId && reply.userId !== user.id) {
            ops.push(
              prisma.notification.create({
                data: {
                  userId: reply.userId,
                  actorUserId: user.id,
                  type: "reply_liked",
                  reviewId: reply.ratingId,
                  replyId,
                  day: reply.rating.day,
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

      const likesCount = await prisma.replyLike.count({
        where: { replyId },
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
          prisma.replyLike.delete({
            where: likeWhere,
          }),
        ];

        if (reply.userId) {
          ops.push(
            prisma.notification.deleteMany({
              where: {
                type: "reply_liked",
                userId: reply.userId,
                actorUserId: user.id,
                replyId,
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

    const likesCount = await prisma.replyLike.count({
      where: { replyId },
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
    console.error("reply-like POST error:", error);
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