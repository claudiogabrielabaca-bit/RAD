import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, source) {
  fs.writeFileSync(path, source, "utf8");
}

function replaceBlock(source, startMarker, nextMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Could not find start marker for ${label}.`);
  }

  const next = source.indexOf(nextMarker, start);
  if (next === -1) {
    throw new Error(`Could not find next marker for ${label}.`);
  }

  return source.slice(0, start) + replacement + source.slice(next);
}

function patchHomeClient() {
  const path = "src/app/home-page-client.tsx";
  let source = read(path);

  const oldCall = "FORCE_FRESH_MODE || attempt > 0";
  const newCall = "FORCE_FRESH_MODE";

  if (source.includes(oldCall)) {
    source = source.replace(oldCall, newCall);
  }

  if (source.includes(oldCall)) {
    throw new Error("home-page-client.tsx still forces fresh Today in History retries.");
  }

  if (!source.includes("await requestTodayHistory(\n          FORCE_FRESH_MODE\n        );")) {
    throw new Error("Could not confirm Today in History now uses cache-first retries.");
  }

  write(path, source);
  console.log("Patched home-page-client.tsx to stop fresh Today in History retries.");
}

function patchTodayRoute() {
  const path = "src/app/api/today-valid-day/route.ts";
  let source = read(path);

  source = source.replace(
    /const MAX_LIVE_HIGHLIGHT_CHECKS = [^;]+;/,
    "const MAX_LIVE_HIGHLIGHT_CHECKS = 2;"
  );

  if (!source.includes("const MAX_LIVE_HIGHLIGHT_CHECKS = 2;")) {
    throw new Error("Could not set Today in History live highlight checks to 2.");
  }

  if (source.includes("await prisma.todayHistoryPool.update")) {
    throw new Error("today-valid-day route still mutates TodayHistoryPool.");
  }

  write(path, source);
  console.log("Patched today-valid-day route for faster cache-first validation.");
}

function patchHomeAuthContract() {
  const path = "scripts/tests/home-page-refactor-contract.test.mjs";
  if (!fs.existsSync(path)) return;

  let source = read(path);

  const startMarker =
    'test("home page delegates auth modal/session state to a dedicated hook", () => {';
  const nextMarker =
    '\ntest("home page keeps review mutation helpers outside the client component", () => {';

  const replacement = `test("home page delegates auth modal/session state to a dedicated hook", () => {
  assert.match(homePage, /useHomeAuthState\\(\\{ router, pathname, searchParams \\}\\)/);
  assert.doesNotMatch(homePage, /fetchCurrentUserClientCached/);
  assert.doesNotMatch(homePage, /setCurrentUserClientCache/);
  assert.doesNotMatch(homePage, /function getAuthViewFromQuery/);
  assert.match(authHook, /function getAuthViewFromQuery/);
  assert.match(authHook, /fetchCurrentUserClientCached/);
  assert.match(authHook, /handleProtectedActionStatus/);
  assert.match(authHook, /requireVerifiedEmail/);
  assert.match(homePage, /void refreshCurrentUser\\(\\)/);
  assert.match(homePage, /requestIdleCallback/);
  assert.match(homePage, /setTimeout\\(run,\\s*1200\\)/);
});
`;

  source = replaceBlock(
    source,
    startMarker,
    nextMarker,
    replacement,
    "home auth refactor contract"
  );

  write(path, source);
  console.log("Patched home auth contract to match deferred current-user refresh.");
}

function patchTodayContract() {
  const path = "scripts/tests/today-in-history-pool-contract.test.mjs";

  if (!fs.existsSync(path)) {
    console.log("Skipped today-in-history-pool-contract patch: file not found.");
    return;
  }

  let source = read(path);

  const startMarker =
    'test("today in history bundle validation can inspect more than one live candidate", () => {';
  const nextMarker =
    '\ntest("today in history keeps large client-side history instead of capping to a few days", () => {';

  const replacement = `test("today in history bundle validation stays cache-first and bounded", () => {
  const route = read("src/app/api/today-valid-day/route.ts");

  assert.match(route, /const MAX_BUNDLE_ATTEMPTS = 12/);
  assert.match(route, /const MAX_LIVE_HIGHLIGHT_CHECKS = 2/);
  assert.doesNotMatch(route, /const MAX_LIVE_HIGHLIGHT_CHECKS = MAX_BUNDLE_ATTEMPTS/);
  assert.doesNotMatch(route, /const MAX_LIVE_HIGHLIGHT_CHECKS = 1/);
});
`;

  source = replaceBlock(
    source,
    startMarker,
    nextMarker,
    replacement,
    "today in history pool contract"
  );

  write(path, source);
  console.log("Patched Today in History pool contract for cache-first performance.");
}

function createPerformanceContract() {
  const path = "scripts/tests/today-in-history-performance-contract.test.mjs";

  const content = `import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("today in history client does not force expensive fresh retries", () => {
  const homePage = read("src/app/home-page-client.tsx");

  assert.match(homePage, /requestTodayHistory\\(\\n\\s*FORCE_FRESH_MODE\\n\\s*\\)/);
  assert.doesNotMatch(homePage, /FORCE_FRESH_MODE \\|\\| attempt > 0/);
});

test("today in history route keeps read requests cache-first and bounded", () => {
  const route = read("src/app/api/today-valid-day/route.ts");

  assert.match(route, /const MAX_LIVE_HIGHLIGHT_CHECKS = 2/);
  assert.doesNotMatch(route, /const MAX_LIVE_HIGHLIGHT_CHECKS = MAX_BUNDLE_ATTEMPTS/);
  assert.doesNotMatch(route, /await prisma\\.todayHistoryPool\\.update/);
});
`;

  write(path, content);
  console.log("Created Today in History performance contract.");
}

patchHomeClient();
patchTodayRoute();
patchHomeAuthContract();
patchTodayContract();
createPerformanceContract();

console.log("Today in History cache-first speed patch completed.");
