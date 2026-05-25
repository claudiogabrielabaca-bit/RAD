import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nextConfig = readFileSync("next.config.ts", "utf8");

test("CSP keeps external connections allowlisted instead of broad https", () => {
  assert.match(nextConfig, /connect-src 'self'/);
  assert.match(nextConfig, /https:\/\/challenges\.cloudflare\.com/);
  assert.match(nextConfig, /https:\/\/static\.cloudflareinsights\.com/);
  assert.match(nextConfig, /https:\/\/cloudflareinsights\.com/);
  assert.doesNotMatch(
    nextConfig,
    /connect-src[^`";]+https:\s*(?:[`";]|\})/,
    "connect-src must not allow every HTTPS origin"
  );
});

test("image hosts are restricted to Wikimedia instead of wildcard HTTPS", () => {
  assert.match(nextConfig, /hostname:\s*"upload\.wikimedia\.org"/);
  assert.match(nextConfig, /hostname:\s*"commons\.wikimedia\.org"/);
  assert.doesNotMatch(nextConfig, /hostname:\s*"\*\*"/);
  assert.doesNotMatch(
    nextConfig,
    /img-src[^`";]+https:\s*(?:[`";]|\})/,
    "img-src must not allow every HTTPS origin"
  );
});

test("CSP still permits RAD runtime requirements", () => {
  assert.match(nextConfig, /const TURNSTILE_ORIGINS = \["https:\/\/challenges\.cloudflare\.com"\]/);
  assert.match(nextConfig, /script-src 'self' 'unsafe-inline'/);
  assert.match(nextConfig, /script-src-elem 'self' 'unsafe-inline'/);
  assert.match(nextConfig, /frame-src 'self' \$\{TURNSTILE_ORIGINS\.join\(" "\)\}/);
  assert.match(nextConfig, /child-src 'self' \$\{TURNSTILE_ORIGINS\.join\(" "\)\}/);
  assert.match(nextConfig, /style-src 'self' 'unsafe-inline'/);
  assert.match(nextConfig, /worker-src 'self' blob:/);
});
