#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootArg = process.argv[2];
const root = path.resolve(rootArg || process.cwd());

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  ".next",
  "out",
  "build",
  "dist",
  "coverage",
  ".vercel",
  ".turbo",
  ".cache",
  ".rad-quarantine",
]);

const allowedExact = new Set([
  ".env.example",
  "prisma/migrations/migration_lock.toml",
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function isInsidePrismaMigrationSql(relativePath) {
  return /^prisma\/migrations\/[^/]+\/migration\.(sql|sqlite|sqlite3)$/i.test(relativePath);
}

function isGeneratedClient(relativePath) {
  return /^src\/generated\//.test(relativePath);
}

function shouldSkipDir(dirName, relativePath) {
  if (ignoredDirs.has(dirName)) return true;
  if (relativePath === "src/generated") return true;
  return false;
}

function isGitTracked(relativePath) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", relativePath], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function classify(relativePath) {
  const base = path.posix.basename(relativePath);
  const lower = relativePath.toLowerCase();

  if (allowedExact.has(relativePath)) return null;
  if (isGeneratedClient(relativePath)) return null;
  if (isInsidePrismaMigrationSql(relativePath)) return null;

  if (base === ".env" || /^\.env\./i.test(base)) {
    if (base === ".env.example") return null;

    if (isGitTracked(relativePath)) {
      return {
        level: "fail",
        reason: "tracked secret/env file",
      };
    }

    return {
      level: "warn",
      reason: "local env file present; allowed locally if ignored by Git and excluded from ZIP",
    };
  }

  if (/\.(pem|key|p12|pfx)$/i.test(base) || /^id_(rsa|ed25519)/i.test(base)) {
    return { level: "fail", reason: "private key / certificate" };
  }

  if (/\.(db|sqlite|sqlite3|dump)$/i.test(base)) {
    return { level: "fail", reason: "database file or dump" };
  }

  if (/\.(zip|7z|rar|tar|tar\.gz|tgz)$/i.test(base)) {
    return { level: "fail", reason: "archive / handoff zip" };
  }

  if (/\.(bak|backup|old|orig|tmp)$/i.test(base)) {
    return { level: "fail", reason: "backup / temporary file" };
  }

  if (/\.log$/i.test(base)) {
    return { level: "fail", reason: "log file" };
  }

  if (/\.tsbuildinfo$/i.test(base)) {
    return { level: "fail", reason: "TypeScript build cache" };
  }

  if (/\.sql$/i.test(base)) {
    return { level: "fail", reason: "raw SQL outside prisma/migrations" };
  }

  if (/^surprise-audit-.*\.json$/i.test(base)) {
    return { level: "fail", reason: "local audit JSON" };
  }

  if (/^today-history-pool-backup-.*\.json$/i.test(base)) {
    return { level: "fail", reason: "local generated backup JSON" };
  }

  if (base === "day-highlight-cache-export.json") {
    return { level: "fail", reason: "local generated cache export" };
  }

  if (lower.startsWith("prisma/backups/")) {
    return { level: "fail", reason: "local database backup directory" };
  }

  if (lower.startsWith("tmp/")) {
    return { level: "fail", reason: "temporary directory" };
  }

  if (lower.startsWith("backups/") || lower.startsWith("dumps/") || lower.startsWith("logs/")) {
    return { level: "fail", reason: "local artifact directory" };
  }

  return null;
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const relative = toPosix(path.relative(root, absolute));

    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name, relative)) continue;
      walk(absolute, out);
      continue;
    }

    if (!entry.isFile()) continue;
    const classification = classify(relative);
    if (classification) {
      out.push({ relative, ...classification });
    }
  }
  return out;
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`Invalid project root: ${root}`);
  process.exit(2);
}

const findings = walk(root).sort((a, b) => a.relative.localeCompare(b.relative));
const failures = findings.filter((item) => item.level === "fail");
const warnings = findings.filter((item) => item.level === "warn");

if (warnings.length > 0) {
  console.warn("Repo hygiene warning(s):\n");
  for (const item of warnings) {
    console.warn(`- ${item.relative}  [${item.reason}]`);
  }
  console.warn("");
}

if (failures.length === 0) {
  if (warnings.length === 0) {
    console.log("Repo hygiene audit passed: no local archives, dumps, secrets, temp SQL, backups or build caches found.");
  } else {
    console.log("Repo hygiene audit passed with warnings: local env files are allowed if they are ignored by Git and excluded from handoff ZIPs.");
  }
  process.exit(0);
}

console.error("Repo hygiene audit failed. These files should not live in the project or be included in handoff ZIPs:\n");
for (const item of failures) {
  console.error(`- ${item.relative}  [${item.reason}]`);
}
console.error("\nMove them outside the repo, or run: npm run repo:quarantine -- -Apply");
console.error("Then re-run: npm run repo:audit");
process.exit(1);
