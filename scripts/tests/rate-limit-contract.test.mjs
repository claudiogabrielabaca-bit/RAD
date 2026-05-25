import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rateLimit = fs.readFileSync("src/app/lib/rate-limit.ts", "utf8");

test("rate limit keys are derived from validated client IP headers", () => {
  assert.match(rateLimit, /import \{ isIP \} from "node:net";/);
  assert.match(rateLimit, /cf-connecting-ip/);
  assert.match(rateLimit, /true-client-ip/);
  assert.match(rateLimit, /x-real-ip/);
  assert.match(rateLimit, /x-forwarded-for/);
  assert.match(rateLimit, /normalizeClientIpCandidate/);
  assert.match(rateLimit, /if \(!isIP\(value\)\)/);
});

test("x-forwarded-for trust can be disabled by environment", () => {
  assert.match(rateLimit, /RAD_TRUST_X_FORWARDED_FOR/);
  assert.match(rateLimit, /process\.env\.RAD_TRUST_X_FORWARDED_FOR !== "0"/);
});

test("rate limit keys hash IP and identifier parts before storage", () => {
  assert.match(rateLimit, /RATE_LIMIT_HASH_PREFIX = "sha256:"/);
  assert.match(rateLimit, /function sha256/);
  assert.match(rateLimit, /normalizeRateLimitKeyPart\(`ip:\$\{getClientIp\(req\)\}`\)/);
  assert.match(rateLimit, /normalizeRateLimitKeyPart\(`id:\$\{identifier\}`\)/);
  assert.doesNotMatch(rateLimit, /return identifier \? `\$\{ip\}:\$\{identifier\}` : ip;/);
});

test("rate limit header parsing strips common port forms and control characters", () => {
  assert.match(rateLimit, /stripIpPort/);
  assert.match(rateLimit, /bracketedIpv6/);
  assert.match(rateLimit, /replace\(\/\[\\r\\n\\t\\0\]\/g, ""\)/);
});
