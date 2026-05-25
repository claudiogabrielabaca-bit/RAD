import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const healthRoute = readFileSync(
  join(root, "src/app/api/health/route.ts"),
  "utf8"
);

test("/api/health exposes a safe database-backed healthcheck", () => {
  assert.match(healthRoute, /export async function GET/);
  assert.match(healthRoute, /prisma\.\$queryRaw`SELECT 1`/);
  assert.match(healthRoute, /DATABASE_CHECK_TIMEOUT_MS/);
  assert.match(healthRoute, /status:\s*ok\s*\?\s*200\s*:\s*503/);
  assert.match(healthRoute, /"Cache-Control":\s*"no-store"/);
  assert.match(healthRoute, /service:\s*"rad"/);
  assert.match(healthRoute, /database/);
  assert.match(healthRoute, /timestamp/);
});

test("/api/health does not expose internal database error details", () => {
  assert.doesNotMatch(healthRoute, /error:\s*error/);
  assert.doesNotMatch(healthRoute, /stack/);
  assert.doesNotMatch(healthRoute, /DATABASE_URL/);
  assert.match(healthRoute, /console\.error/);
});
