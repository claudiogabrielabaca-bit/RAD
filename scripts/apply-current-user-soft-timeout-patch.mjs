import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, source) {
  fs.writeFileSync(path, source, "utf8");
}

function patchCurrentUser() {
  const path = "src/app/lib/current-user.ts";
  let source = read(path);

  if (!source.includes("getCurrentUserWithin")) {
    source = `${source.trim()}

export async function getCurrentUserWithin(timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return getCurrentUser();
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      getCurrentUser(),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
`;
  }

  write(path, source);
  console.log("Patched src/app/lib/current-user.ts");
}

function patchDayBundle() {
  const path = "src/app/lib/day-bundle.ts";
  let source = read(path);

  source = source.replace(
    'import { getCurrentUser } from "@/app/lib/current-user";',
    'import { getCurrentUser, getCurrentUserWithin } from "@/app/lib/current-user";'
  );

  if (!source.includes("DAY_BUNDLE_CURRENT_USER_TIMEOUT_MS")) {
    source = source.replace(
      "const ANONYMOUS_DAY_BUNDLE_CACHE_TTL_MS = 60 * 1000;",
      `const ANONYMOUS_DAY_BUNDLE_CACHE_TTL_MS = 60 * 1000;
const DAY_BUNDLE_CURRENT_USER_TIMEOUT_MS = 900;`
    );
  }

  const oldBlock = `export async function buildDayBundle(day: string) {
  const currentUserStartedAt = Date.now();
  const user = await getCurrentUser();`;

  const newBlock = `export async function buildDayBundle(day: string) {
  const currentUserStartedAt = Date.now();
  const user = await getCurrentUserWithin(DAY_BUNDLE_CURRENT_USER_TIMEOUT_MS);`;

  if (!source.includes(newBlock)) {
    if (!source.includes(oldBlock)) {
      throw new Error("Could not find buildDayBundle current-user block.");
    }

    source = source.replace(oldBlock, newBlock);
  }

  if (!/export async function buildDayCommunityBundle\(day: string\)\s*\{\s*const user = await getCurrentUser\(\);/s.test(source)) {
    throw new Error("buildDayCommunityBundle must keep strict getCurrentUser().");
  }

  write(path, source);
  console.log("Patched src/app/lib/day-bundle.ts");
}

patchCurrentUser();
patchDayBundle();

console.log("Current user soft-timeout patch completed.");
