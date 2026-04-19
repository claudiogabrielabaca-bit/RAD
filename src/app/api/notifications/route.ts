import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type NotificationRow = {
  id: string;
  type: string;
  day: string | null;
  isRead: boolean;
  createdAt: Date;
  actorUser: {
    username: string;
  };
};

function formatMessage(type: string, username: string) {
  switch (type) {
    case "review_liked":
      return `@${username} liked your review`;
    case "review_replied":
      return `@${username} replied to your review`;
    case "reply_liked":
      return `@${username} liked your reply`;
    default:
      return `@${username} interacted with your content`;
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to view notifications." },
        { status: 401 }
      );
    }

    const [notifications, unreadCount]: [NotificationRow[], number] =
      await Promise.all([
        prisma.notification.findMany({
          where: {
            userId: user.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
          select: {
            id: true,
            type: true,
            day: true,
            isRead: true,
            createdAt: true,
            actorUser: {
              select: {
                username: true,
              },
            },
          },
        }),
        prisma.notification.count({
          where: {
            userId: user.id,
            isRead: false,
          },
        }),
      ]);

    const items = notifications.map((item: NotificationRow) => ({
      id: item.id,
      type: item.type,
      day: item.day,
      isRead: item.isRead,
      createdAt: item.createdAt.toISOString(),
      actorUsername: item.actorUser.username,
      message: formatMessage(item.type, item.actorUser.username),
    }));

    return NextResponse.json(
      {
        items,
        unreadCount,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("notifications GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}