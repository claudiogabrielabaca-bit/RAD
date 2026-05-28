type SoftRateLimitBucket = {
  count: number;
  expiresAt: number;
};

type PrismaErrorCode = "P2002" | "P2003";

export function createTimingLogger(label: string, enabled: boolean) {
  const startedAt = Date.now();
  let lastAt = startedAt;
  const parts: string[] = [];

  function mark(step: string) {
    if (!enabled) return;

    const now = Date.now();
    parts.push(`${step}=${now - lastAt}ms`);
    lastAt = now;
  }

  function log(extra = "") {
    if (!enabled) return;

    const total = Date.now() - startedAt;
    const suffix = extra ? ` ${extra}` : "";
    console.log(`[${label}] ${parts.join(" ")} total=${total}ms${suffix}`);
  }

  return {
    mark,
    log,
  };
}

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

export function isPrismaError(error: unknown, code: PrismaErrorCode) {
  return getPrismaErrorCode(error) === code;
}

export function createSoftRateLimiter({
  windowMs,
  limit,
  sweepEvery = 250,
}: {
  windowMs: number;
  limit: number;
  sweepEvery?: number;
}) {
  const buckets = new Map<string, SoftRateLimitBucket>();
  let sweepCounter = 0;

  return function consumeSoftRateLimit(key: string) {
    const now = Date.now();

    sweepCounter += 1;

    if (sweepCounter % sweepEvery === 0) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.expiresAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    const existing = buckets.get(key);

    if (!existing || existing.expiresAt <= now) {
      buckets.set(key, {
        count: 1,
        expiresAt: now + windowMs,
      });

      return {
        ok: true,
        retryAfterSec: 0,
      };
    }

    if (existing.count >= limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(
          1,
          Math.ceil((existing.expiresAt - now) / 1000)
        ),
      };
    }

    existing.count += 1;
    buckets.set(key, existing);

    return {
      ok: true,
      retryAfterSec: 0,
    };
  };
}
