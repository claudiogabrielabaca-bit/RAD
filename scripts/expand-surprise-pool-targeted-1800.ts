import { prisma } from "../src/app/lib/prisma";
import { ensureHighlightsForDay } from "../src/app/lib/highlight-service";

type OnThisDayEntry = {
  year?: number;
  text?: string;
};

type OnThisDayResponse = {
  selected?: OnThisDayEntry[];
  events?: OnThisDayEntry[];
  births?: OnThisDayEntry[];
  deaths?: OnThisDayEntry[];
};

type Candidate = {
  day: string;
  year: number;
  month: number;
  dayOfMonth: number;
  source: "selected" | "events" | "births" | "deaths";
  text: string;
};

type Args = {
  minYear: number;
  maxYear: number;
  maxAdded: number;
  maxCandidates: number;
  delayMs: number;
  fetchDelayMs: number;
  maxMonthDays: number | null;
  offsetMonthDays: number;
  dryRun: boolean;
};

const DEFAULT_ARGS: Args = {
  minYear: 1800,
  maxYear: 1899,
  maxAdded: 25,
  maxCandidates: 1000,
  delayMs: 1000,
  fetchDelayMs: 3000,
  maxMonthDays: null,
  offsetMonthDays: 0,
  dryRun: false,
};

const SOURCE_PRIORITY: Record<Candidate["source"], number> = {
  selected: 0,
  events: 1,
  births: 2,
  deaths: 3,
};

function parseArgs(): Args {
  const args = { ...DEFAULT_ARGS };

  for (const raw of process.argv.slice(2)) {
    const [key, value] = raw.replace(/^--/, "").split("=");

    if (key === "minYear" && value) args.minYear = Number(value);
    if (key === "maxYear" && value) args.maxYear = Number(value);
    if (key === "maxAdded" && value) args.maxAdded = Number(value);
    if (key === "maxCandidates" && value) args.maxCandidates = Number(value);
    if (key === "delayMs" && value) args.delayMs = Number(value);
    if (key === "fetchDelayMs" && value) args.fetchDelayMs = Number(value);
    if (key === "maxMonthDays" && value) args.maxMonthDays = Number(value);
    if (key === "offsetMonthDays" && value) args.offsetMonthDays = Number(value);
    if (key === "dryRun") args.dryRun = true;
  }

  return args;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function getDaysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function isValidDayForYearMonthDay(year: number, month: number, day: number) {
  return day >= 1 && day <= getDaysInMonth(year, month);
}

function buildDay(year: number, month: number, dayOfMonth: number) {
  return `${year}-${pad2(month)}-${pad2(dayOfMonth)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Orden anterior:
 * 01-01, 01-02, 01-03...
 *
 * Orden nuevo:
 * 01-01, 02-01, 03-01... 12-01
 * 01-02, 02-02, 03-02... 12-02
 *
 * Esto evita cargar siempre enero/febrero/marzo/abril primero.
 */
function getDistributedMonthDayPairs(
  maxMonthDays: number | null,
  offsetMonthDays: number
) {
  const allPairs: Array<{ month: number; dayOfMonth: number }> = [];

  for (let dayOfMonth = 1; dayOfMonth <= 31; dayOfMonth += 1) {
    for (let month = 1; month <= 12; month += 1) {
      if (!isValidDayForYearMonthDay(2024, month, dayOfMonth)) continue;

      allPairs.push({ month, dayOfMonth });
    }
  }

  const safeOffset = Math.max(0, offsetMonthDays);
  const sliced = allPairs.slice(safeOffset);

  if (maxMonthDays === null) {
    return sliced;
  }

  return sliced.slice(0, Math.max(0, maxMonthDays));
}

function getCandidateWeight(candidate: Candidate) {
  const sourceWeight = SOURCE_PRIORITY[candidate.source] * 10_000;
  const eventBias =
    candidate.source === "selected" || candidate.source === "events" ? 0 : 1_000;

  return sourceWeight + eventBias + candidate.year;
}

function roundRobinByMonth(candidates: Candidate[]) {
  const byMonth = new Map<number, Candidate[]>();

  for (const candidate of candidates) {
    const group = byMonth.get(candidate.month) ?? [];
    group.push(candidate);
    byMonth.set(candidate.month, group);
  }

  for (const group of byMonth.values()) {
    group.sort((a, b) => {
      return (
        getCandidateWeight(a) - getCandidateWeight(b) ||
        a.day.localeCompare(b.day)
      );
    });
  }

  const ordered: Candidate[] = [];
  let added = true;

  while (added) {
    added = false;

    for (let month = 1; month <= 12; month += 1) {
      const group = byMonth.get(month);

      if (!group || group.length === 0) continue;

      const next = group.shift();

      if (!next) continue;

      ordered.push(next);
      added = true;
    }
  }

  return ordered;
}

function getRetryAfterMs(response: Response) {
  const retryAfter = response.headers.get("retry-after");

  if (!retryAfter) return null;

  const retryAfterNumber = Number(retryAfter);

  if (Number.isFinite(retryAfterNumber)) {
    return Math.max(1000, retryAfterNumber * 1000);
  }

  const retryAfterDate = new Date(retryAfter).getTime();

  if (Number.isFinite(retryAfterDate)) {
    return Math.max(1000, retryAfterDate - Date.now());
  }

  return null;
}

async function fetchOnThisDay(month: number, dayOfMonth: number) {
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${pad2(
    month
  )}/${pad2(dayOfMonth)}`;

  const maxRetries = 4;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "RAD Surprise Pool Expander/1.0 (Rate Any Day in Human History)",
        Accept: "application/json",
      },
    });

    if (response.ok) {
      return (await response.json()) as OnThisDayResponse;
    }

    if (response.status === 429) {
      const retryAfterMs = getRetryAfterMs(response);
      const fallbackMs = 15_000 * attempt;
      const waitMs = retryAfterMs ?? fallbackMs;

      console.warn(
        `  rate limited on ${pad2(month)}-${pad2(
          dayOfMonth
        )}, retry ${attempt}/${maxRetries}, waiting ${waitMs}ms`
      );

      await sleep(waitMs);
      continue;
    }

    if (response.status === 502 || response.status === 503 || response.status === 504) {
      const waitMs = 5000 * attempt;

      console.warn(
        `  temporary Wikimedia error ${response.status} on ${pad2(month)}-${pad2(
          dayOfMonth
        )}, retry ${attempt}/${maxRetries}, waiting ${waitMs}ms`
      );

      await sleep(waitMs);
      continue;
    }

    throw new Error(`Wikipedia OnThisDay HTTP ${response.status}`);
  }

  throw new Error(
    `Wikipedia OnThisDay failed after ${maxRetries} retries for ${pad2(
      month
    )}-${pad2(dayOfMonth)}`
  );
}

function collectCandidatesFromResponse(
  payload: OnThisDayResponse,
  month: number,
  dayOfMonth: number,
  minYear: number,
  maxYear: number
) {
  const candidates: Candidate[] = [];

  const sections: Array<Candidate["source"]> = [
    "selected",
    "events",
    "births",
    "deaths",
  ];

  for (const source of sections) {
    const entries = payload[source] ?? [];

    for (const entry of entries) {
      const year = Number(entry.year);

      if (!Number.isInteger(year)) continue;
      if (year < minYear || year > maxYear) continue;
      if (!isValidDayForYearMonthDay(year, month, dayOfMonth)) continue;

      const text = typeof entry.text === "string" ? entry.text.trim() : "";

      if (!text) continue;

      candidates.push({
        day: buildDay(year, month, dayOfMonth),
        year,
        month,
        dayOfMonth,
        source,
        text,
      });
    }
  }

  return candidates;
}

async function getExistingValidDays() {
  const rows = await prisma.dayHighlightCache.findMany({
    where: {
      type: { not: "none" },
      title: { not: null },
      text: { not: "" },
    },
    select: {
      day: true,
    },
  });

  return new Set(rows.map((row) => row.day));
}

async function isDayNowUsable(day: string) {
  const row = await prisma.dayHighlightCache.findFirst({
    where: {
      day,
      type: { not: "none" },
      title: { not: null },
      text: { not: "" },
    },
    select: {
      day: true,
      title: true,
      type: true,
    },
  });

  return row;
}

async function printCurrentDistribution() {
  const rows = await prisma.dayHighlightCache.findMany({
    where: {
      type: { not: "none" },
      title: { not: null },
      text: { not: "" },
    },
    select: {
      day: true,
    },
  });

  const centuries = new Map<string, number>();
  const months = new Map<string, number>();

  for (const row of rows) {
    const year = Number(row.day.slice(0, 4));
    const century = `${Math.floor(year / 100) * 100}`;
    const month = row.day.slice(5, 7);

    centuries.set(century, (centuries.get(century) ?? 0) + 1);
    months.set(month, (months.get(month) ?? 0) + 1);
  }

  console.log("");
  console.log("Current valid days:", rows.length);

  console.log("");
  console.log("centuries");
  for (const [century, count] of [...centuries.entries()].sort()) {
    console.log(`${century}: ${count}`);
  }

  console.log("");
  console.log("months");
  for (const [month, count] of [...months.entries()].sort()) {
    console.log(`${month}: ${count}`);
  }
}

async function main() {
  const args = parseArgs();

  console.log("=== EXPAND SURPRISE POOL TARGETED 1800 ===");
  console.log("minYear:", args.minYear);
  console.log("maxYear:", args.maxYear);
  console.log("maxAdded:", args.maxAdded);
  console.log("maxCandidates:", args.maxCandidates);
  console.log("delayMs:", args.delayMs);
  console.log("fetchDelayMs:", args.fetchDelayMs);
  console.log("maxMonthDays:", args.maxMonthDays);
  console.log("offsetMonthDays:", args.offsetMonthDays);
  console.log("dryRun:", args.dryRun);

  const existingValidDays = await getExistingValidDays();
  const monthDayPairs = getDistributedMonthDayPairs(
    args.maxMonthDays,
    args.offsetMonthDays
  );
  const rawCandidates: Candidate[] = [];

  console.log("");
  console.log("Fetching Wikipedia OnThisDay candidate dates...");
  console.log("month-days to fetch:", monthDayPairs.length);

  if (monthDayPairs.length > 0) {
    const preview = monthDayPairs
      .slice(0, 24)
      .map((pair) => `${pad2(pair.month)}-${pad2(pair.dayOfMonth)}`)
      .join(", ");

    console.log("first month-days:", preview);
  }

  for (const { month, dayOfMonth } of monthDayPairs) {
    try {
      console.log(`fetching ${pad2(month)}-${pad2(dayOfMonth)}...`);

      const payload = await fetchOnThisDay(month, dayOfMonth);
      const candidates = collectCandidatesFromResponse(
        payload,
        month,
        dayOfMonth,
        args.minYear,
        args.maxYear
      );

      rawCandidates.push(...candidates);

      if (candidates.length > 0) {
        console.log(`  candidates found: ${candidates.length}`);
      }
    } catch (error) {
      console.error(
        `failed to fetch ${pad2(month)}-${pad2(dayOfMonth)}:`,
        error
      );
    }

    await sleep(args.fetchDelayMs);
  }

  const deduped = new Map<string, Candidate>();

  for (const candidate of rawCandidates) {
    if (existingValidDays.has(candidate.day)) continue;

    const previous = deduped.get(candidate.day);

    if (!previous || getCandidateWeight(candidate) < getCandidateWeight(previous)) {
      deduped.set(candidate.day, candidate);
    }
  }

  const orderedCandidates = roundRobinByMonth([...deduped.values()]).slice(
    0,
    args.maxCandidates
  );

  console.log("");
  console.log("raw candidates:", rawCandidates.length);
  console.log("new deduped candidates:", deduped.size);
  console.log("selected candidates:", orderedCandidates.length);

  let added = 0;
  let unusable = 0;
  let failed = 0;
  let checked = 0;

  for (const candidate of orderedCandidates) {
    if (!args.dryRun && added >= args.maxAdded) break;
    if (args.dryRun && checked >= args.maxAdded) break;

    checked += 1;

    console.log(
      `[${checked}/${orderedCandidates.length}] probing ${candidate.day} (${candidate.source}) added ${added}/${args.maxAdded}`
    );

    if (args.dryRun) {
      console.log(`  dryRun candidate: ${candidate.text.slice(0, 180)}`);
      continue;
    }

    try {
      const result = await ensureHighlightsForDay(candidate.day);
      const primary = result.highlight;

      if (
        !primary ||
        primary.type === "none" ||
        !primary.title ||
        !primary.text
      ) {
        unusable += 1;
        console.log("  skip: no usable highlight");
        await sleep(args.delayMs);
        continue;
      }

      const confirmed = await isDayNowUsable(candidate.day);

      if (!confirmed) {
        unusable += 1;
        console.log("  skip: highlight returned but cache row not confirmed");
        await sleep(args.delayMs);
        continue;
      }

      added += 1;
      existingValidDays.add(candidate.day);

      console.log(`  added: ${confirmed.title} (${confirmed.type})`);
    } catch (error) {
      failed += 1;
      console.error("  failed:", error);
    }

    await sleep(args.delayMs);
  }

  console.log("");
  console.log("=== DONE ===");
  console.log("checked:", checked);
  console.log("added:", added);
  console.log("unusable:", unusable);
  console.log("failed:", failed);

  await printCurrentDistribution();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });