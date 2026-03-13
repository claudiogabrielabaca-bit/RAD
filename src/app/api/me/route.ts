import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentUser();

    return NextResponse.json(
      {
        user: user
          ? {
              id: user.id,
              email: user.email,
              username: user.username,
              emailVerified: user.emailVerified,
              createdAt: user.createdAt.toISOString(),
            }
          : null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("me GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}