import { NextResponse } from "next/server";
import { clearSession } from "@/app/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await clearSession();

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("logout POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}