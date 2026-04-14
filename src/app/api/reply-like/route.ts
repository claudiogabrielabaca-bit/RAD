import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function isPrismaError(
  error: unknown,
  code: "P2002" | "P2025"
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to like a reply." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await req.json().catch(() => null);
    const replyId = body?.replyId;
    const desiredLiked =
      typeof body?.liked === "boolean" ? body.liked : null;

    if (!replyId || typeof replyId !== "string") {
      return NextResponse.json(
        { error: "Invalid replyId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const reply = await prisma.ratingReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        userId: true,
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
          await prisma.$transaction(async (tx) => {
            await tx.replyLike.create({
              data: {
                replyId,
                userId: user.id,
                anonId: null,
              },
            });

            if (reply.userId && reply.userId !== user.id) {
              await tx.notification.create({
                data: {
                  userId: reply.userId,
                  actorUserId: user.id,
                  type: "reply_liked",
                  replyId,
                  day: reply.rating.day,
                },
              });
            }
          });
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
          likedByMe: true,
          likesCount,
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    if (existingLike) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.replyLike.delete({
            where: likeWhere,
          });

          if (reply.userId) {
            await tx.notification.deleteMany({
              where: {
                type: "reply_liked",
                userId: reply.userId,
                actorUserId: user.id,
                replyId,
              },
            });
          }
        });
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
        likedByMe: false,
        likesCount,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("reply-like POST error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}