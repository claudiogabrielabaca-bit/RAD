import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

function assertFileContains(relativePath, patterns) {
  const source = read(relativePath);

  for (const [pattern, message] of patterns) {
    assert.match(source, pattern, `${relativePath}: ${message}`);
  }
}

test("user sessions are stored as hashed tokens and secure cookies", () => {
  assertFileContains("src/app/lib/auth.ts", [
    [/randomBytes\(32\)\.toString\("hex"\)/, "session token must be 32 random bytes encoded as hex"],
    [/createHmac\("sha256", getSessionSecret\(\)\)/, "session token must be HMAC-hashed before database storage"],
    [/httpOnly:\s*true/, "session cookie must be httpOnly"],
    [/sameSite:\s*"lax"/, "user session cookie should use SameSite=Lax"],
    [/secure:\s*process\.env\.NODE_ENV === "production"/, "session cookie must be secure in production"],
    [/priority:\s*"high"/, "session cookie must use high priority"],
  ]);
});

test("admin sessions are stored as hashed tokens and stricter cookies", () => {
  assertFileContains("src/app/lib/admin.ts", [
    [/randomBytes\(32\)\.toString\("hex"\)/, "admin session token must be 32 random bytes encoded as hex"],
    [/createHmac\("sha256", getAdminSessionSecret\(\)\)/, "admin session token must be HMAC-hashed before database storage"],
    [/httpOnly:\s*true/, "admin cookie must be httpOnly"],
    [/sameSite:\s*"strict"/, "admin cookie should use SameSite=Strict"],
    [/secure:\s*process\.env\.NODE_ENV === "production"/, "admin cookie must be secure in production"],
  ]);
});

test("login and registration routes keep bot/rate-limit protections", () => {
  for (const route of [
    "src/app/api/register/route.ts",
    "src/app/api/login/route.ts",
  ]) {
    assertFileContains(route, [
      [/consumeRateLimit/, "must consume a persistent rate limit before expensive auth work"],
      [/buildRateLimitKey/, "must build a rate-limit key from request context"],
      [/verifyTurnstileToken/, "must verify Cloudflare Turnstile token"],
      [/createRateLimitResponse/, "must return a proper 429 response when limited"],
      [/Cache-Control":\s*"no-store"/, "auth responses must disable caching"],
    ]);
  }
});

test("verification and login-code routes keep brute-force protections", () => {
  for (const route of [
    "src/app/api/login-code/route.ts",
    "src/app/api/verify-email/route.ts",
    "src/app/api/resend-login-code/route.ts",
    "src/app/api/resend-verification/route.ts",
    "src/app/api/forgot-password/route.ts",
    "src/app/api/reset-password/route.ts",
  ]) {
    assertFileContains(route, [
      [/consumeRateLimit/, "must consume rate limit for auth-code/reset flows"],
      [/Cache-Control":\s*"no-store"/, "auth-code/reset responses must disable caching"],
    ]);
  }
});

test("admin routes require admin session before exposing moderation data", () => {
  for (const route of [
    "src/app/api/admin/stats/route.ts",
    "src/app/api/admin/reports/route.ts",
    "src/app/api/admin/recent-reviews/route.ts",
    "src/app/api/admin/delete-review/route.ts",
    "src/app/api/admin/report-resolve/route.ts",
  ]) {
    assertFileContains(route, [
      [/requireAdminSession/, "must require an admin session"],
      [/Not found/, "unauthenticated admin access should not reveal that the route exists"],
      [/Cache-Control":\s*"no-store"/, "admin responses must disable caching"],
    ]);
  }
});

test("user mutation/report routes require an authenticated user and rate limits", () => {
  for (const route of [
    "src/app/api/rate/route.ts",
    "src/app/api/review-reply/route.ts",
    "src/app/api/review-report/route.ts",
    "src/app/api/reply-report/route.ts",
    "src/app/api/suggest-event/route.ts",
    "src/app/api/report-bug/route.ts",
  ]) {
    assertFileContains(route, [
      [/getCurrentUser/, "must read the current user before mutating user-owned data"],
      [/consumeRateLimit/, "must rate-limit user mutation/report actions"],
      [/createRateLimitResponse/, "must return a proper 429 response when limited"],
    ]);
  }
});
