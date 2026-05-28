import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("src/app/rad-control-room/page.tsx", "utf8");
const utils = fs.readFileSync("src/app/rad-control-room/control-room-utils.ts", "utf8");

test("rad control room keeps pure DTO helpers outside the page component", () => {
  assert.match(page, /from "@\/app\/rad-control-room\/control-room-utils"/);

  assert.match(utils, /export type StatusFilter/);
  assert.match(utils, /export const emptyStats/);
  assert.match(utils, /export function isObject/);
  assert.match(utils, /export function readReportsPayload/);
  assert.match(utils, /export function readReviewsPayload/);
  assert.match(utils, /export function readStatsPayload/);
  assert.match(utils, /export function formatDateTime/);
  assert.match(utils, /export function statusLabel/);
  assert.match(utils, /export function statusClassName/);
  assert.match(utils, /export function reportTypeClassName/);
  assert.match(utils, /export function normalizeDisplayText/);

  assert.doesNotMatch(page, /type StatusFilter =/);
  assert.doesNotMatch(page, /const emptyStats: AdminStatsPayload =/);
  assert.doesNotMatch(page, /function isObject\(/);
  assert.doesNotMatch(page, /function readReportsPayload\(/);
  assert.doesNotMatch(page, /function readReviewsPayload\(/);
  assert.doesNotMatch(page, /function readStatsPayload\(/);
  assert.doesNotMatch(page, /function formatDateTime\(/);
  assert.doesNotMatch(page, /function statusLabel\(/);
  assert.doesNotMatch(page, /function statusClassName\(/);
  assert.doesNotMatch(page, /function reportTypeClassName\(/);
  assert.doesNotMatch(page, /function normalizeDisplayText\(/);
});
