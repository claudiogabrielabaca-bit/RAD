import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BIO_MAX_LENGTH = 160;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const body = await req.json().catch(() => null);
    const bioValue = body?.bio;

    if (typeof bioValue !== "string") {
      return NextResponse.json({ error: "Invalid bio." }, { status: 400 });
    }

    const bio = bioValue.slice(0, BIO_MAX_LENGTH).trim();

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        bio: bio.length ? bio : null,
      },
      select: {
        bio: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        bio: updatedUser.bio ?? "",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("profile bio POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}