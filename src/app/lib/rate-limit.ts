import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export function buildRateLimitKey(req: Request, email?: string) {
  const ip = getClientIp(req);
  return email ? `${ip}:${email.trim().toLowerCase()}` : ip;
}

export async function consumeRateLimit({
  action,
  key,
  limit,
  windowMs,
}: {
  action: string;
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = new Date();
  const expiresAt = new Date(Date.now() + windowMs);

  const existing = await prisma.rateLimit.findUnique({
    where: {
      action_key: {
        action,
        key,
      },
    },
  });

  if (!existing) {
    await prisma.rateLimit.create({
      data: {
        action,
        key,
        count: 1,
        expiresAt,
      },
    });

    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: 0,
    };
  }

  if (existing.expiresAt <= now) {
    await prisma.rateLimit.update({
      where: {
        action_key: {
          action,
          key,
        },
      },
      data: {
        count: 1,
        expiresAt,
      },
    });

    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(
        1,
        Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000)
      ),
    };
  }

  const updated = await prisma.rateLimit.update({
    where: {
      action_key: {
        action,
        key,
      },
    },
    data: {
      count: {
        increment: 1,
      },
    },
  });

  return {
    ok: true,
    remaining: Math.max(0, limit - updated.count),
    retryAfterSec: 0,
  };
}

export function createRateLimitResponse(
  retryAfterSec: number,
  message = "Too many requests. Please try again later."
) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    }
  );
}