import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to clear notifications." },
        { status: 401 }
      );
    }

    await prisma.notification.deleteMany({
      where: {
        userId: user.id,
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
    console.error("notifications/clear POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}