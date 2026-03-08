import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getOrCreateAnonId } from "@/app/lib/anon";

function clampStars(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, Math.floor(n)));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad JSON" }, { status: 400 });

  const { day, stars, review } = body as {
    day?: string;
    stars?: number;
    review?: string;
  };

  if (!day || typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  }

  const s = clampStars(Number(stars));
  if (s < 1 || s > 5) {
    return NextResponse.json({ error: "Invalid stars" }, { status: 400 });
  }
  
  const text = (review ?? "").toString().trim();

if (text.length > 500) {
  return NextResponse.json(
    { error: "Review too long (max 500)" },
    { status: 400 }
  );
}
  


  // ✅ anonId se genera/lee desde cookie en SERVER (no lo manda el cliente)
  const anonId = await getOrCreateAnonId();

  await prisma.rating.upsert({
    where: { anonId_day: { anonId, day } },
    update: { stars: s, review: text },
    create: { anonId, day, stars: s, review: text },
  });

  return NextResponse.json({ ok: true });
}