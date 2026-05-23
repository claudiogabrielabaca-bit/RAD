import { getCurrentUser } from "@/app/lib/current-user";
import { getNotificationsPayload } from "@/app/lib/notifications-cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to view notifications." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const payload = await getNotificationsPayload(user.id);

    return NextResponse.json(payload, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("notifications GET error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
