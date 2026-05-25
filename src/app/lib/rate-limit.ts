import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { isIP } from "node:net";

const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_CLEANUP_EVERY_REQUESTS = 250;
const RATE_LIMIT_KEY_PART_MAX_LENGTH = 256;
const UNKNOWN_CLIENT_IP = "unknown";
const RATE_LIMIT_HASH_PREFIX = "sha256:";

const TRUSTED_SINGLE_IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
  "x-client-ip",
];

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

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeRateLimitKeyPart(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\r\n\t\0]/g, "");
  return normalized || UNKNOWN_CLIENT_IP;
}

function normalizeRateLimitKeyPart(value: string) {
  const normalized = sanitizeRateLimitKeyPart(value);

  if (normalized.length > RATE_LIMIT_KEY_PART_MAX_LENGTH) {
    return `${RATE_LIMIT_HASH_PREFIX}${sha256(normalized)}`;
  }

  return `${RATE_LIMIT_HASH_PREFIX}${sha256(normalized)}`;
}

function stripIpPort(candidate: string) {
  let value = candidate.trim().replace(/^"|"$/g, "");

  const bracketedIpv6 = value.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6?.[1]) {
    return bracketedIpv6[1];
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.replace(/:\d+$/, "");
  }

  return value;
}

function normalizeClientIpCandidate(candidate: string | null) {
  if (!candidate) return null;

  const value = stripIpPort(candidate);

  if (!isIP(value)) {
    return null;
  }

  return value.toLowerCase();
}

function getFirstValidIpFromHeaderValue(value: string | null) {
  if (!value) return null;

  for (const candidate of value.split(",")) {
    const ip = normalizeClientIpCandidate(candidate);
    if (ip) return ip;
  }

  return null;
}

function getTrustedSingleHeaderIp(headers: Headers) {
  for (const headerName of TRUSTED_SINGLE_IP_HEADERS) {
    const ip = getFirstValidIpFromHeaderValue(headers.get(headerName));
    if (ip) return ip;
  }

  return null;
}

function shouldTrustForwardedForHeader() {
  return process.env.RAD_TRUST_X_FORWARDED_FOR !== "0";
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
  const trustedHeaderIp = getTrustedSingleHeaderIp(req.headers);
  if (trustedHeaderIp) return trustedHeaderIp;

  if (shouldTrustForwardedForHeader()) {
    const forwardedForIp = getFirstValidIpFromHeaderValue(
      req.headers.get("x-forwarded-for")
    );

    if (forwardedForIp) return forwardedForIp;
  }

  return UNKNOWN_CLIENT_IP;
}

export function buildRateLimitKey(req: Request, identifier?: string) {
  const ipPart = normalizeRateLimitKeyPart(`ip:${getClientIp(req)}`);
  const identifierPart = identifier
    ? normalizeRateLimitKeyPart(`id:${identifier}`)
    : "";

  return identifierPart ? `${ipPart}:${identifierPart}` : ipPart;
}

function buildAllowedResult(limit: number, count: number): ConsumeRateLimitResult {
  return {
    ok: true,
    remaining: Math.max(0, limit - count),
    retryAfterSec: 0,
  };
}

function buildLimitedResult(expiresAt: Date): ConsumeRateLimitResult {
  return {
    ok: false,
    remaining: 0,
    retryAfterSec: Math.max(
      1,
      Math.ceil((expiresAt.getTime() - Date.now()) / 1000)
    ),
  };
}

async function readRateLimitRow({
  action,
  key,
}: {
  action: string;
  key: string;
}): Promise<RateLimitRow | null> {
  return prisma.rateLimit.findUnique({
    where: {
      action_key: {
        action,
        key,
      },
    },
  });
}

async function createRateLimitRow({
  action,
  key,
  expiresAt,
}: {
  action: string;
  key: string;
  expiresAt: Date;
}) {
  await prisma.rateLimit.create({
    data: {
      action,
      key,
      count: 1,
      expiresAt,
    },
  });

  return buildAllowedResult(0, 1);
}

async function resetExpiredRateLimitRow({
  action,
  key,
  expiresAt,
}: {
  action: string;
  key: string;
  expiresAt: Date;
}) {
  const updated = await prisma.rateLimit.update({
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

  return updated;
}

async function incrementRateLimitRow({
  action,
  key,
}: {
  action: string;
  key: string;
}) {
  return prisma.rateLimit.update({
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
}

async function consumeRateLimitOnce({
  action,
  key,
  limit,
  windowMs,
}: {
  action: string;
  key: string;
  limit: number;
  windowMs: number;
}): Promise<ConsumeRateLimitResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  const existing = await readRateLimitRow({ action, key });

  if (!existing) {
    await createRateLimitRow({ action, key, expiresAt });
    return buildAllowedResult(limit, 1);
  }

  if (existing.expiresAt <= now) {
    const updated = await resetExpiredRateLimitRow({ action, key, expiresAt });
    return buildAllowedResult(limit, updated.count);
  }

  if (existing.count >= limit) {
    return buildLimitedResult(existing.expiresAt);
  }

  const updated = await incrementRateLimitRow({ action, key });
  return buildAllowedResult(limit, updated.count);
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
      return await consumeRateLimitOnce({
        action,
        key,
        limit,
        windowMs,
      });
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
