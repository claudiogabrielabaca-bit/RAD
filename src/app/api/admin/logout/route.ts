import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const res = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  await clearAdminSessionCookie(res);

  return res;
}