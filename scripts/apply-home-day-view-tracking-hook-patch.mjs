import fs from "node:fs";

const homePath = "src/app/home-page-client.tsx";
const testPath = "scripts/tests/home-page-refactor-contract.test.mjs";

let home = fs.readFileSync(homePath, "utf8");
let tests = fs.readFileSync(testPath, "utf8");

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  }
  return source.replace(search, replacement);
}

home = replaceOnce(
  home,
  'import { useHomeFavoriteDay } from "@/app/hooks/use-home-favorite-day";\n',
  'import { useHomeFavoriteDay } from "@/app/hooks/use-home-favorite-day";\nimport { useHomeDayViewTracking } from "@/app/hooks/use-home-day-view-tracking";\n',
  "insert useHomeDayViewTracking import"
);

home = replaceOnce(
  home,
  '  DAY_VIEW_TRACKING_DELAY_MS,\n',
  "",
  "remove DAY_VIEW_TRACKING_DELAY_MS import from home page"
);

home = replaceOnce(
  home,
  '  const dayViewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n',
  "",
  "remove dayViewTimeoutRef from home page"
);

home = replaceOnce(
  home,
  `  const { toggleFavoriteDay, refreshFavoriteDayStatus } = useHomeFavoriteDay({
    day,
    currentUser,
    hasPickedInitialDay,
    initialBundle,
    dayBundleCacheRef,
    isFavoriteDay,
    loadingFavoriteDay,
    setIsFavoriteDay,
    setLoadingFavoriteDay,
    openAuthModal,
    requireVerifiedEmail,
    showToast,
  });
`,
  `  const { toggleFavoriteDay, refreshFavoriteDayStatus } = useHomeFavoriteDay({
    day,
    currentUser,
    hasPickedInitialDay,
    initialBundle,
    dayBundleCacheRef,
    isFavoriteDay,
    loadingFavoriteDay,
    setIsFavoriteDay,
    setLoadingFavoriteDay,
    openAuthModal,
    requireVerifiedEmail,
    showToast,
  });

  useHomeDayViewTracking({
    day,
    hasPickedInitialDay,
  });
`,
  "insert useHomeDayViewTracking call"
);

home = replaceOnce(
  home,
  `    async function run() {
      if (dayViewTimeoutRef.current) {
        clearTimeout(dayViewTimeoutRef.current);
      }

      dayViewTimeoutRef.current = setTimeout(() => {
        dayViewTimeoutRef.current = null;

        if (cancelled || document.visibilityState !== "visible") {
          return;
        }

        const payload = JSON.stringify({ day });

        if (navigator.sendBeacon) {
          const blob = new Blob([payload], {
            type: "application/json",
          });

          if (navigator.sendBeacon("/api/day-view", blob)) {
            return;
          }
        }

        fetch("/api/day-view", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }, DAY_VIEW_TRACKING_DELAY_MS);

      if (skipNextAutoDayLoadRef.current) {
`,
  `    async function run() {
      if (skipNextAutoDayLoadRef.current) {
`,
  "remove day-view tracking from day loading effect"
);

if (home.includes("DAY_VIEW_TRACKING_DELAY_MS")) {
  throw new Error("DAY_VIEW_TRACKING_DELAY_MS still appears in home-page-client.tsx");
}

if (home.includes("dayViewTimeoutRef")) {
  throw new Error("dayViewTimeoutRef still appears in home-page-client.tsx");
}

if (!home.includes("useHomeDayViewTracking({")) {
  throw new Error("useHomeDayViewTracking call was not inserted");
}

fs.writeFileSync(homePath, home);

if (!tests.includes('const dayViewTrackingHook = fs.readFileSync("src/app/hooks/use-home-day-view-tracking.ts", "utf8");')) {
  tests = replaceOnce(
    tests,
    'const dayBackHistoryHook = fs.readFileSync("src/app/hooks/use-home-day-back-history.ts", "utf8");\n',
    'const dayBackHistoryHook = fs.readFileSync("src/app/hooks/use-home-day-back-history.ts", "utf8");\nconst dayViewTrackingHook = fs.readFileSync("src/app/hooks/use-home-day-view-tracking.ts", "utf8");\n',
    "insert day view tracking hook fixture"
  );
}

if (!tests.includes('home page delegates day view tracking to a dedicated hook')) {
  tests += `

test("home page delegates day view tracking to a dedicated hook", () => {
  assert.match(homePage, /useHomeDayViewTracking\\(\\{\\n    day,\\n    hasPickedInitialDay,\\n  \\}\\);/);
  assert.doesNotMatch(homePage, /dayViewTimeoutRef/);
  assert.doesNotMatch(homePage, /navigator\\.sendBeacon/);
  assert.doesNotMatch(homePage, /DAY_VIEW_TRACKING_DELAY_MS/);
  assert.match(dayViewTrackingHook, /export function useHomeDayViewTracking/);
  assert.match(dayViewTrackingHook, /DAY_VIEW_TRACKING_DELAY_MS/);
  assert.match(dayViewTrackingHook, /navigator\\.sendBeacon/);
  assert.match(dayViewTrackingHook, /keepalive: true/);
});
`;
}

fs.writeFileSync(testPath, tests);

console.log("Patched src/app/home-page-client.tsx to use useHomeDayViewTracking.");
