import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const helper = fs.readFileSync("src/app/lib/like-route-utils.ts", "utf8");
const reviewLikeRoute = fs.readFileSync("src/app/api/review-like/route.ts", "utf8");
const replyLikeRoute = fs.readFileSync("src/app/api/reply-like/route.ts", "utf8");

test("like routes share low-level timing, prisma error, and soft rate-limit helpers", () => {
  assert.match(helper, /export function createTimingLogger/);
  assert.match(helper, /export function isPrismaError/);
  assert.match(helper, /export function createSoftRateLimiter/);

  for (const source of [reviewLikeRoute, replyLikeRoute]) {
    assert.match(source, /from "@\/app\/lib\/like-route-utils"/);
    assert.match(source, /createSoftRateLimiter\(\{/);
    assert.doesNotMatch(source, /function createTimingLogger\(label: string\)/);
    assert.doesNotMatch(source, /function getPrismaErrorCode/);
    assert.doesNotMatch(source, /type SoftRateLimitBucket/);
  }
});
