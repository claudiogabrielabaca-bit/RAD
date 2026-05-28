import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync("src/app/home-page-client.tsx", "utf8");
const requests = fs.readFileSync("src/app/lib/home-page-client-requests.ts", "utf8");

test("home page delegates client request helpers outside the main component", () => {
  assert.match(requests, /export type TodayInHistoryResponse/);
  assert.match(requests, /async function fetchNoStoreJson/);
  assert.match(requests, /export async function fetchPickDateBundle/);
  assert.match(requests, /export function fetchSurpriseBundle/);
  assert.match(requests, /export function fetchRandomDayCandidate/);
  assert.match(requests, /export function fetchTodayHistoryRequest/);
  assert.match(requests, /\/api\/pick-date-bundle/);
  assert.match(requests, /cache: "no-store"/);
  assert.match(requests, /res\.json\(\)\.catch\(\(\) => null\)/);

  assert.match(home, /from "@\/app\/lib\/home-page-client-requests"/);
  assert.match(home, /fetchPickDateBundle/);
  assert.match(home, /fetchSurpriseBundle/);
  assert.match(home, /fetchRandomDayCandidate/);
  assert.match(home, /fetchTodayHistoryRequest/);
  assert.match(home, /type TodayInHistoryResponse/);

  assert.doesNotMatch(home, /fetch\(/);
  assert.doesNotMatch(home, /res\.json\(\)\.catch\(\(\) => null\)/);
  assert.doesNotMatch(home, /async function fetchPickDateBundle/);
  assert.doesNotMatch(home, /type TodayInHistoryResponse = SurpriseResponse/);
  assert.doesNotMatch(home, /\/api\/pick-date-bundle/);
});
