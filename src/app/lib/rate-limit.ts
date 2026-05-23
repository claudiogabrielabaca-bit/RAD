import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { createHash } from "crypto";

const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_CLEANUP_EVERY_REQUESTS = 250;
const RATE_LIMIT_KEY_PART_MAX_LENGTH = 256;

let rateLimitCleanupCounter = 0;


type RateLimitRow = {
  id: string;
  action: string;
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type RateLimitUpdateData = {
  count?:
    | number
    | {
        increment: number;
      };
  expiresAt?: Date;
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
      data: RateLimitUpdateData;
    }): Promise<RateLimitRow>;
  };
};

type ConsumeRateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

function isRetryableRateLimitError(error: unknown) {
  const code = getPrismaErrorCode(error);
  return code === "P2002" || code === "P2025";
}

function normalizeRateLimitKeyPart(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.length <= RATE_LIMIT_KEY_PART_MAX_LENGTH) {
    return normalized || "unknown";
  }

  return `sha256:${createHash("sha256").update(normalized).digest("hex")}`;
}

function maybeCleanupExpiredRateLimits() {
  rateLimitCleanupCounter += 1;

  if (rateLimitCleanupCounter % RATE_LIMIT_CLEANUP_EVERY_REQUESTS !== 0) {
    return;
  }

  void prisma.rateLimit
    .deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })
    .catch((error: unknown) => {
      console.error("rate limit cleanup error:", error);
    });
}

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return normalizeRateLimitKeyPart(forwarded.split(",")[0] ?? "unknown");
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return normalizeRateLimitKeyPart(realIp);
  }

  return "unknown";
}

export function buildRateLimitKey(req: Request, email?: string) {
  const ip = getClientIp(req);
  const identifier = email ? normalizeRateLimitKeyPart(email) : "";

  return identifier ? `${ip}:${identifier}` : ip;
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
  maybeCleanupExpiredRateLimits();

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
