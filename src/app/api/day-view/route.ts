import { prisma } from "@/app/lib/prisma";
import { isValidDayString } from "@/app/lib/day";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const day = body?.day;

    if (!isValidDayString(day)) {
      return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    }

    await prisma.$executeRaw`
      INSERT INTO "DayStats" ("id", "day", "views", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${day}, 1, NOW(), NOW())
      ON CONFLICT ("day")
      DO UPDATE SET
        "views" = "DayStats"."views" + 1,
        "updatedAt" = NOW()
    `;

    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("day-view POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
