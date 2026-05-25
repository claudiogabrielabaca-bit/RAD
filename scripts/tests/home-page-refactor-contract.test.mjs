import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const homePage = fs.readFileSync("src/app/home-page-client.tsx", "utf8");
const authHook = fs.readFileSync("src/app/hooks/use-home-auth-state.ts", "utf8");
const reviewState = fs.readFileSync("src/app/lib/home-page-review-state.ts", "utf8");
const constants = fs.readFileSync("src/app/lib/home-page-client-constants.ts", "utf8");

test("home page delegates auth modal/session state to a dedicated hook", () => {
  assert.match(homePage, /useHomeAuthState\(\{ router, pathname, searchParams \}\)/);
  assert.doesNotMatch(homePage, /fetchCurrentUserClientCached/);
  assert.doesNotMatch(homePage, /setCurrentUserClientCache/);
  assert.doesNotMatch(homePage, /function getAuthViewFromQuery/);
  assert.match(authHook, /function getAuthViewFromQuery/);
  assert.match(authHook, /fetchCurrentUserClientCached/);
  assert.match(authHook, /handleProtectedActionStatus/);
  assert.match(authHook, /requireVerifiedEmail/);
  assert.match(homePage, /refreshCurrentUser\(\);\n  \}, \[refreshCurrentUser\]\);/);
});

test("home page keeps review mutation helpers outside the client component", () => {
  assert.match(homePage, /from "@\/app\/lib\/home-page-review-state"/);
  assert.doesNotMatch(homePage, /function withUpdatedReviews/);
  assert.doesNotMatch(homePage, /function removeReplyFromTree/);
  assert.match(reviewState, /export function withUpdatedReviews/);
  assert.match(reviewState, /export function removeReplyFromTree/);
});

test("home page uses shared constants instead of local magic numbers", () => {
  assert.match(homePage, /from "@\/app\/lib\/home-page-client-constants"/);
  assert.doesNotMatch(homePage, /const REVIEW_MAX_LENGTH = 280/);
  assert.match(constants, /export const REVIEW_MAX_LENGTH = 280/);
  assert.match(constants, /export const HIGHLIGHT_SCROLL_OFFSET = 365/);
});
