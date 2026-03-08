import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const day = body?.day;

    if (!day || typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }

    const stats = await prisma.dayStats.upsert({
      where: { day },
      update: {
        views: {
          increment: 1,
        },
      },
      create: {
        day,
        views: 1,
      },
      select: {
        day: true,
        views: true,
      },
    });

    return NextResponse.json(
      { ok: true, day: stats.day, views: stats.views },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("day-view POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}