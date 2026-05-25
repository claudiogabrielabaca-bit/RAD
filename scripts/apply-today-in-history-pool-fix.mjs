import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, source) {
  fs.writeFileSync(path, source, "utf8");
}

function patchDeferredAuthContract() {
  const path = "scripts/tests/home-page-refactor-contract.test.mjs";

  if (!fs.existsSync(path)) {
    console.log("Skipped auth contract patch: file not found.");
    return;
  }

  let source = read(path);
  const startMarker =
    'test("home page delegates auth modal/session state to a dedicated hook", () => {';
  const start = source.indexOf(startMarker);

  if (start === -1) {
    throw new Error("Could not find auth refactor contract block.");
  }

  const end = source.indexOf("\n});", start);

  if (end === -1) {
    throw new Error("Could not find auth refactor contract block end.");
  }

  const replacement = `test("home page delegates auth modal/session state to a dedicated hook", () => {
  assert.match(homePage, /useHomeAuthState\\\\(\\\\{ router, pathname, searchParams \\\\}\\\\)/);
  assert.doesNotMatch(homePage, /fetchCurrentUserClientCached/);
  assert.doesNotMatch(homePage, /setCurrentUserClientCache/);
  assert.doesNotMatch(homePage, /function getAuthViewFromQuery/);
  assert.match(authHook, /function getAuthViewFromQuery/);
  assert.match(authHook, /fetchCurrentUserClientCached/);
  assert.match(authHook, /handleProtectedActionStatus/);
  assert.match(authHook, /requireVerifiedEmail/);
  assert.match(homePage, /void refreshCurrentUser\\\\(\\\\)/);
  assert.match(homePage, /requestIdleCallback/);
  assert.match(homePage, /setTimeout\\\\(run,\\\\s*1200\\\\)/);
});`;

  source =
    source.slice(0, start) + replacement + source.slice(end + "\n});".length);

  write(path, source);
  console.log("Updated deferred current-user auth contract.");
}

function patchTodayValidDayRoute() {
  const path = "src/app/api/today-valid-day/route.ts";

  if (!fs.existsSync(path)) {
    throw new Error("Missing src/app/api/today-valid-day/route.ts");
  }

  let source = read(path);

  source = source.replace(
    "const MAX_LIVE_HIGHLIGHT_CHECKS = 1;",
    "const MAX_LIVE_HIGHLIGHT_CHECKS = MAX_BUNDLE_ATTEMPTS;"
  );

  const removeStart = source.indexOf("async function removeDayFromTodayPool(day: string) {");
  const removeEnd = source.indexOf("\nexport async function GET", removeStart);

  if (removeStart === -1 || removeEnd === -1) {
    throw new Error("Could not find removeDayFromTodayPool block.");
  }

  const safeRemoveFunction = `async function removeDayFromTodayPool(day: string) {
  if (!isValidDayString(day)) return;

  const monthDay = day.slice(5, 10);

  /*
   * Important:
   * This is a read endpoint. It must not shrink TodayHistoryPool.
   *
   * A cached highlight can be temporarily unusable because of cache gaps,
   * upstream fetch failures, local Railway latency, or fallback text.
   * Removing the day here permanently reduces Today in History variety and
   * is the reason the feature can collapse to only 2 or 3 visible days.
   *
   * Pool repair/backfill belongs in scripts/build-today-history-pools.ts,
   * not in /api/today-valid-day.
   */
  logTodayValidDayWarning("today-valid-day kept candidate in pool:", {
    day,
    monthDay,
    reason: "read-route-does-not-mutate-pool",
  });
}
`;

  source =
    source.slice(0, removeStart) +
    safeRemoveFunction +
    source.slice(removeEnd + 1);

  if (source.includes("await prisma.todayHistoryPool.update")) {
    throw new Error("today-valid-day route still mutates TodayHistoryPool.");
  }

  if (!source.includes("const MAX_LIVE_HIGHLIGHT_CHECKS = MAX_BUNDLE_ATTEMPTS;")) {
    throw new Error("MAX_LIVE_HIGHLIGHT_CHECKS was not expanded.");
  }

  write(path, source);
  console.log("Patched today-valid-day route to preserve TodayHistoryPool variety.");
}

patchDeferredAuthContract();
patchTodayValidDayRoute();

console.log("Today in History pool preservation patch completed.");
