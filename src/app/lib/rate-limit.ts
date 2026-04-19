import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

const MAX_RATE_LIMIT_RETRIES = 3;

type PrismaErrorWithCode = {
  code: string;
};

type RateLimitRow = {
  id: string;
  action: string;
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type RateLimitTransactionClient = {
  rateLimit: {
    findUnique(args: {
      where: {
        action_key: {
          action: string;
          key: string;
        };
      };
    }): Promise<RateLimitRow | null>;
    create(args: {
      data: {
        action: string;
        key: string;
        count: number;
        expiresAt: Date;
      };
    }): Promise<unknown>;
    update(args: {
      where: {
        action_key: {
          action: string;
          key: string;
        };
      };
      data: {
        count?: {
          increment: number;
        };
        expiresAt?: Date;
      };
    }): Promise<RateLimitRow>;
  };
};

type ConsumeRateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

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

function isRetryableRateLimitError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code !== "" &&
    (error as { code: string }).code !== undefined &&
    ["P2002", "P2025"].includes((error as { code: string }).code)
  );
}

async function consumeRateLimitInTransaction(
  tx: RateLimitTransactionClient,
  {
    action,
    key,
    limit,
    windowMs,
  }: {
    action: string;
    key: string;
    limit: number;
    windowMs: number;
  }
): Promise<ConsumeRateLimitResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  const existing = await tx.rateLimit.findUnique({
    where: {
      action_key: {
        action,
        key,
      },
    },
  });

  if (!existing) {
    await tx.rateLimit.create({
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
    await tx.rateLimit.update({
      where: {
        action_key: {
          action,
          key,
        },
      },
      data: {
        count: 1 as never,
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

  const updated = await tx.rateLimit.update({
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
  for (let attempt = 0; attempt < MAX_RATE_LIMIT_RETRIES; attempt++) {
    try {
      return await prisma.$transaction((tx: RateLimitTransactionClient) =>
        consumeRateLimitInTransaction(tx, {
          action,
          key,
          limit,
          windowMs,
        })
      );
    } catch (error) {
      const shouldRetry =
        attempt < MAX_RATE_LIMIT_RETRIES - 1 &&
        isRetryableRateLimitError(error);

      if (shouldRetry) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Failed to consume rate limit after retries.");
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