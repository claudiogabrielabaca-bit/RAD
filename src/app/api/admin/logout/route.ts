import { NextResponse } from "next/server";
import { getAdminCookieName } from "@/app/lib/admin";

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

  res.cookies.set({
    name: getAdminCookieName(),
    value: "",
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}