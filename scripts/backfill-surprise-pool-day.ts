import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SURPRISE_POOL_BACKFILL_VERSION = "v1-effective-from-day-highlight-cache";

const EFFECTIVE_POOL_MIN_SIZE = 120;
const DEFAULT_MONTH_DAY_CAP = 5;
const APRIL_MONTH_DAY_CAP = 3;
const APRIL_HOT_MONTH_DAY_CAP = 2;
const MONTH_CAP_MIN = 24;
const MONTH_CAP_MAX = 90;
const MONTH_CAP_FACTOR = 1.15;
const APRIL_MONTH_CAP_FACTOR = 0.7;

type Args = {
  dryRun: boolean;
  replaceActive: boolean;
};

type RawCacheRow = {
  day: string;
  type: string;
  title: string | null;
  text: string;
  image: string | null;
  articleUrl: string | null;
  updatedAt: Date;
};

type DayStatsRow = {
  day: string;
  views: number;
};

type EffectiveCandidate = RawCacheRow & {
  views: number;
};

function parseArgs(): Args {
  const args: Args = {
    dryRun: false,
    replaceActive: true,
  };

  for (const raw of process.argv.slice(2)) {
    const [key, value] = raw.replace(/^--/, "").split("=");

    if (key === "dryRun") args.dryRun = true;
    if (key === "replaceActive" && value === "false") args.replaceActive = false;
  }

  return args;
}

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseYear(day: string) {
  return Number(day.slice(0, 4));
}

function parseMonth(day: string) {
  return Number(day.slice(5, 7));
}

function parseDayOfMonth(day: string) {
  return Number(day.slice(8, 10));
}

function parseMonthDay(day: string) {
  return day.slice(5, 10);
}

function getDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

function getCentury(year: number) {
  return Math.floor(year / 100) * 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stableHash(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function uniqueSortedStrings(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function incrementMapCount<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function getMonthDayCap(monthDay: string) {
  if (monthDay === "04-27" || monthDay === "04-28" || monthDay === "04-29") {
    return APRIL_HOT_MONTH_DAY_CAP;
  }

  if (monthDay.startsWith("04-")) {
    return APRIL_MONTH_DAY_CAP;
  }

  return DEFAULT_MONTH_DAY_CAP;
}

function getMonthCap(month: number, rawTotal: number) {
  const base = clamp(
    Math.ceil((rawTotal / 12) * MONTH_CAP_FACTOR),
    MONTH_CAP_MIN,
    MONTH_CAP_MAX
  );

  if (month === 4) {
    return clamp(Math.floor(base * APRIL_MONTH_CAP_FACTOR), 18, base);
  }

  return base;
}

function rankEffectiveCandidate(candidate: EffectiveCandidate) {
  const year = parseYear(candidate.day);
  const decade = getDecade(year);
  const century = getCentury(year);

  return (
    candidate.views * 1000 +
    Math.max(0, 2026 - year) * 0.35 +
    Math.abs(decade - 1950) * 0.05 +
    Math.abs(century - 1900) * 0.02 +
    stableHash(candidate.day) / 1_000_000
  );
}

function selectDiverseCandidates(
  candidates: EffectiveCandidate[],
  max: number
) {
  if (candidates.length <= max) return [...candidates];

  const remaining = [...candidates];
  const selected: EffectiveCandidate[] = [];
  const decadeUsage = new Map<number, number>();
  const centuryUsage = new Map<number, number>();

  while (remaining.length > 0 && selected.length < max) {
    remaining.sort((a, b) => {
      const aYear = parseYear(a.day);
      const bYear = parseYear(b.day);

      const aDecade = getDecade(aYear);
      const bDecade = getDecade(bYear);

      const aCentury = getCentury(aYear);
      const bCentury = getCentury(bYear);

      const aScore =
        rankEffectiveCandidate(a) +
        (decadeUsage.get(aDecade) ?? 0) * 160 +
        (centuryUsage.get(aCentury) ?? 0) * 55;

      const bScore =
        rankEffectiveCandidate(b) +
        (decadeUsage.get(bDecade) ?? 0) * 160 +
        (centuryUsage.get(bCentury) ?? 0) * 55;

      return aScore - bScore || a.day.localeCompare(b.day);
    });

    const picked = remaining.shift();

    if (!picked) break;

    selected.push(picked);

    const pickedYear = parseYear(picked.day);
    incrementMapCount(decadeUsage, getDecade(pickedYear));
    incrementMapCount(centuryUsage, getCentury(pickedYear));
  }

  return selected;
}

function buildEffectiveSurpriseRows(
  rawRows: RawCacheRow[],
  viewsByDay: Map<string, number>
) {
  const uniqueRowsByDay = new Map<string, EffectiveCandidate>();

  for (const row of rawRows) {
    if (!isValidDayString(row.day)) continue;
    if (!row.title || !row.text.trim()) continue;

    uniqueRowsByDay.set(row.day, {
      ...row,
      views: viewsByDay.get(row.day) ?? 0,
    });
  }

  const rawCandidates = Array.from(uniqueRowsByDay.values());
  const byMonthDay = new Map<string, EffectiveCandidate[]>();

  for (const candidate of rawCandidates) {
    const monthDay = parseMonthDay(candidate.day);
    const group = byMonthDay.get(monthDay) ?? [];
    group.push(candidate);
    byMonthDay.set(monthDay, group);
  }

  const cappedMonthDayCandidates: EffectiveCandidate[] = [];

  for (const [monthDay, group] of byMonthDay.entries()) {
    const cap = getMonthDayCap(monthDay);
    cappedMonthDayCandidates.push(...selectDiverseCandidates(group, cap));
  }

  const byMonth = new Map<number, EffectiveCandidate[]>();

  for (const candidate of cappedMonthDayCandidates) {
    const month = parseMonth(candidate.day);
    const group = byMonth.get(month) ?? [];
    group.push(candidate);
    byMonth.set(month, group);
  }

  const effective = new Map<string, EffectiveCandidate>();

  for (let month = 1; month <= 12; month += 1) {
    const group = byMonth.get(month) ?? [];
    const cap = getMonthCap(month, rawCandidates.length);
    const selected = selectDiverseCandidates(group, cap);

    for (const candidate of selected) {
      effective.set(candidate.day, candidate);
    }
  }

  if (effective.size < Math.min(EFFECTIVE_POOL_MIN_SIZE, rawCandidates.length)) {
    const fallbackCandidates = selectDiverseCandidates(
      rawCandidates.filter((candidate) => !effective.has(candidate.day)),
      Math.min(EFFECTIVE_POOL_MIN_SIZE, rawCandidates.length) - effective.size
    );

    for (const candidate of fallbackCandidates) {
      effective.set(candidate.day, candidate);
    }
  }

  return uniqueSortedStrings(Array.from(effective.keys()))
    .map((day) => effective.get(day))
    .filter((candidate): candidate is EffectiveCandidate => !!candidate);
}

function getQualityScore(candidate: EffectiveCandidate) {
  let score = 1000;

  score -= Math.min(400, candidate.views * 10);

  if (candidate.type === "selected") score += 120;
  if (candidate.image) score += 40;
  if (candidate.articleUrl) score += 40;

  const year = parseYear(candidate.day);

  if (year >= 1800 && year <= 1899) score += 80;
  if (year >= 2000) score += 40;

  return Math.max(0, Math.round(score));
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

async function main() {
  const args = parseArgs();

  console.log("=== BACKFILL SURPRISE POOL DAY ===");
  console.log("version:", SURPRISE_POOL_BACKFILL_VERSION);
  console.log("dryRun:", args.dryRun);
  console.log("replaceActive:", args.replaceActive);

  const rows: RawCacheRow[] = await prisma.dayHighlightCache.findMany({
    where: {
      type: { not: "none" },
      title: { not: null },
      text: { not: "" },
    },
    select: {
      day: true,
      type: true,
      title: true,
      text: true,
      image: true,
      articleUrl: true,
      updatedAt: true,
    },
  });

  const rawDays = uniqueSortedStrings(
    rows
      .map((row) => row.day)
      .filter((day): day is string => isValidDayString(day))
  );

  const statsRows: DayStatsRow[] =
    rawDays.length > 0
      ? await prisma.dayStats.findMany({
          where: {
            day: {
              in: rawDays,
            },
          },
          select: {
            day: true,
            views: true,
          },
        })
      : [];

  const viewsByDay = new Map(statsRows.map((row) => [row.day, row.views]));
  const effectiveRows = buildEffectiveSurpriseRows(rows, viewsByDay);

  console.log("raw valid days:", rawDays.length);
  console.log("effective rows:", effectiveRows.length);

  console.log("");
  console.log("effective centuries");
  for (const [key, value] of countBy(effectiveRows, (row) =>
    String(getCentury(parseYear(row.day)))
  )) {
    console.log(`${key}: ${value}`);
  }

  console.log("");
  console.log("effective months");
  for (const [key, value] of countBy(effectiveRows, (row) =>
    row.day.slice(5, 7)
  )) {
    console.log(`${key}: ${value}`);
  }

  if (args.dryRun) {
    console.log("");
    console.log("Dry run only. No rows were written.");
    return;
  }

  if (args.replaceActive) {
    await prisma.surprisePoolDay.updateMany({
      data: {
        active: false,
      },
    });
  }

  let upserted = 0;

  for (const candidate of effectiveRows) {
    const year = parseYear(candidate.day);
    const month = parseMonth(candidate.day);
    const dayOfMonth = parseDayOfMonth(candidate.day);
    const monthDay = parseMonthDay(candidate.day);
    const decade = getDecade(year);
    const century = getCentury(year);

    await prisma.surprisePoolDay.upsert({
      where: {
        day: candidate.day,
      },
      update: {
        year,
        month,
        dayOfMonth,
        monthDay,
        decade,
        century,
        type: candidate.type,
        title: candidate.title ?? "",
        text: candidate.text,
        image: candidate.image,
        articleUrl: candidate.articleUrl,
        source: SURPRISE_POOL_BACKFILL_VERSION,
        qualityScore: getQualityScore(candidate),
        active: true,
      },
      create: {
        day: candidate.day,
        year,
        month,
        dayOfMonth,
        monthDay,
        decade,
        century,
        type: candidate.type,
        title: candidate.title ?? "",
        text: candidate.text,
        image: candidate.image,
        articleUrl: candidate.articleUrl,
        source: SURPRISE_POOL_BACKFILL_VERSION,
        qualityScore: getQualityScore(candidate),
        active: true,
      },
    });

    upserted += 1;
  }

  console.log("");
  console.log("upserted active rows:", upserted);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });