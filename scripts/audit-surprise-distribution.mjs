import fs from "node:fs";

const BASE_URL = process.argv[2] || "https://rateanyday.com";
const SAME_SESSION_RUNS = Number(process.argv[3] || 1000);
const FRESH_SESSION_RUNS = Number(process.argv[4] || 1000);

function parseSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    const values = headers.getSetCookie();
    return values.map((value) => value.split(";")[0]).join("; ");
  }

  const single = headers.get("set-cookie");
  if (!single) return "";
  return single.split(",").map((part) => part.split(";")[0]).join("; ");
}

async function fetchJson(url, cookie = "") {
  const res = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : {},
  });

  const text = await res.text();
  let data = null;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }

  const setCookie = parseSetCookie(res.headers);

  return {
    ok: res.ok,
    status: res.status,
    data,
    cookie: setCookie || cookie,
  };
}

function monthFromDay(day) {
  return day.slice(5, 7);
}

function monthDayFromDay(day) {
  return day.slice(5, 10);
}

function yearFromDay(day) {
  return Number(day.slice(0, 4));
}

function decadeFromDay(day) {
  return Math.floor(yearFromDay(day) / 10) * 10;
}

function eraFromDay(day) {
  const year = yearFromDay(day);
  if (year >= 1800 && year <= 1899) return "nineteenth";
  if (year >= 2000) return "twentyFirst";
  return "twentieth";
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function toSortedObject(map) {
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => {
      if (typeof a[0] === "number" && typeof b[0] === "number") {
        return a[0] - b[0];
      }
      return String(a[0]).localeCompare(String(b[0]));
    })
  );
}

function topN(map, n = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, n);
}

async function runSameSessionAudit() {
  let cookie = "";
  const seen = new Set();
  const monthCounts = new Map();
  const monthDayCounts = new Map();
  const yearCounts = new Map();
  const decadeCounts = new Map();
  const eraCounts = new Map();
  const sourceCounts = new Map();

  let repeated = 0;
  let firstTotal = null;
  let minRemaining = Infinity;
  let maxRemaining = -Infinity;

  const samples = [];

  for (let i = 0; i < SAME_SESSION_RUNS; i += 1) {
    const result = await fetchJson(`${BASE_URL}/api/surprise`, cookie);
    cookie = result.cookie;

    if (!result.ok) {
      throw new Error(
        `Same-session audit failed at run ${i + 1}: ${result.status} ${JSON.stringify(result.data)}`
      );
    }

    const payload = result.data;
    const day = payload.day;

    if (!day || typeof day !== "string") {
      throw new Error(`Missing day at run ${i + 1}`);
    }

    if (seen.has(day)) {
      repeated += 1;
    }
    seen.add(day);

    increment(monthCounts, monthFromDay(day));
    increment(monthDayCounts, monthDayFromDay(day));
    increment(yearCounts, yearFromDay(day));
    increment(decadeCounts, decadeFromDay(day));
    increment(eraCounts, eraFromDay(day));
    increment(sourceCounts, payload.source || "unknown");

    if (typeof payload.total === "number" && firstTotal === null) {
      firstTotal = payload.total;
    }

    if (typeof payload.remaining === "number") {
      minRemaining = Math.min(minRemaining, payload.remaining);
      maxRemaining = Math.max(maxRemaining, payload.remaining);
    }

    if (i < 15) {
      samples.push({
        run: i + 1,
        day,
        remaining: payload.remaining,
        total: payload.total,
        source: payload.source,
      });
    }
  }

  return {
    runs: SAME_SESSION_RUNS,
    uniqueDays: seen.size,
    repeatedDays: repeated,
    firstReportedTotal: firstTotal,
    minRemaining: Number.isFinite(minRemaining) ? minRemaining : null,
    maxRemaining: Number.isFinite(maxRemaining) ? maxRemaining : null,
    monthCounts: toSortedObject(monthCounts),
    eraCounts: toSortedObject(eraCounts),
    sourceCounts: toSortedObject(sourceCounts),
    topMonthDays: topN(monthDayCounts, 20),
    topYears: topN(yearCounts, 20),
    topDecades: topN(decadeCounts, 20),
    first15Samples: samples,
  };
}

async function runFreshSessionAudit() {
  const monthCounts = new Map();
  const monthDayCounts = new Map();
  const yearCounts = new Map();
  const decadeCounts = new Map();
  const eraCounts = new Map();
  const sourceCounts = new Map();

  const firstPickCounts = new Map();

  for (let i = 0; i < FRESH_SESSION_RUNS; i += 1) {
    const result = await fetchJson(`${BASE_URL}/api/surprise`);

    if (!result.ok) {
      throw new Error(
        `Fresh-session audit failed at run ${i + 1}: ${result.status} ${JSON.stringify(result.data)}`
      );
    }

    const payload = result.data;
    const day = payload.day;

    if (!day || typeof day !== "string") {
      throw new Error(`Missing day at fresh run ${i + 1}`);
    }

    increment(monthCounts, monthFromDay(day));
    increment(monthDayCounts, monthDayFromDay(day));
    increment(yearCounts, yearFromDay(day));
    increment(decadeCounts, decadeFromDay(day));
    increment(eraCounts, eraFromDay(day));
    increment(sourceCounts, payload.source || "unknown");
    increment(firstPickCounts, day);
  }

  return {
    runs: FRESH_SESSION_RUNS,
    uniqueFirstPicks: firstPickCounts.size,
    monthCounts: toSortedObject(monthCounts),
    eraCounts: toSortedObject(eraCounts),
    sourceCounts: toSortedObject(sourceCounts),
    topFirstPicks: topN(firstPickCounts, 20),
    topMonthDays: topN(monthDayCounts, 20),
    topYears: topN(yearCounts, 20),
    topDecades: topN(decadeCounts, 20),
  };
}

async function main() {
  console.log(`Auditing ${BASE_URL}`);
  console.log(`Same-session runs: ${SAME_SESSION_RUNS}`);
  console.log(`Fresh-session runs: ${FRESH_SESSION_RUNS}`);

  const sameSession = await runSameSessionAudit();
  const freshSessions = await runFreshSessionAudit();

  const report = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    sameSession,
    freshSessions,
  };

  const outputPath = `surprise-audit-${Date.now()}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log("=== SAME SESSION ===");
  console.log(JSON.stringify(sameSession, null, 2));
  console.log("");
  console.log("=== FRESH SESSIONS ===");
  console.log(JSON.stringify(freshSessions, null, 2));
  console.log("");
  console.log(`Saved report to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});