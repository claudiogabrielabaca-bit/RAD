import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

type Args = {
  target: number;
  maxAdded: number;
  maxAttempts: number;
  delayMs: number;
  minYear: number;
  maxYear: number;
  requireImage: boolean;
};

type ValidCacheRow = {
  day: string;
  type: string;
  title: string | null;
  text: string;
  image: string | null;
};

type PoolState = {
  validDays: Set<string>;
  cachedDays: Set<string>;
  monthUsage: Map<number, number>;
  monthDayUsage: Map<string, number>;
  yearUsage: Map<number, number>;
  decadeUsage: Map<number, number>;
  centuryUsage: Map<number, number>;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);

  const getNumber = (name: string, fallback: number) => {
    const raw = args.find((arg) => arg.startsWith(`--${name}=`));
    if (!raw) return fallback;

    const value = Number(raw.split("=")[1]);
    return Number.isFinite(value) ? value : fallback;
  };

  const getBoolean = (name: string, fallback: boolean) => {
    const raw = args.find((arg) => arg.startsWith(`--${name}=`));
    if (!raw) return fallback;

    const value = raw.split("=")[1]?.toLowerCase();
    return value === "true" ? true : value === "false" ? false : fallback;
  };

  const currentYear = new Date().getFullYear();

  return {
    target: Math.max(1, getNumber("target", 500)),
    maxAdded: Math.max(1, getNumber("maxAdded", 50)),
    maxAttempts: Math.max(1, getNumber("maxAttempts", 300)),
    delayMs: Math.max(0, getNumber("delayMs", 350)),
    minYear: Math.max(1, getNumber("minYear", 1900)),
    maxYear: Math.min(currentYear, getNumber("maxYear", currentYear)),
    requireImage: getBoolean("requireImage", false),
  };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

function getCentury(year: number) {
  return Math.floor(year / 100) * 100;
}

function getYear(day: string) {
  return Number(day.slice(0, 4));
}

function getMonth(day: string) {
  return Number(day.slice(5, 7));
}

function getMonthDay(day: string) {
  return day.slice(5, 10);
}

function increment<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function weightedPick<T>(items: { value: T; weight: number }[]) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);

  if (items.length === 0) return null;
  if (total <= 0) return shuffleArray(items)[0]?.value ?? null;

  let roll = Math.random() * total;

  for (const item of items) {
    roll -= Math.max(0, item.weight);

    if (roll <= 0) {
      return item.value;
    }
  }

  return items[items.length - 1]?.value ?? null;
}

function getMonthDayTemplatesForMonth(month: number) {
  const templates: string[] = [];
  const maxDay = getDaysInMonth(2024, month);

  for (let day = 1; day <= maxDay; day += 1) {
    templates.push(`${pad2(month)}-${pad2(day)}`);
  }

  return templates;
}

function isValidForMonthDay(year: number, month: number, day: number) {
  if (month === 2 && day === 29) {
    return isLeapYear(year);
  }

  return day <= getDaysInMonth(year, month);
}

function isUsableHighlight(
  result: Awaited<ReturnType<typeof ensureHighlightsForDay>>,
  options: { requireImage: boolean }
) {
  const highlight = result.highlight;

  if (!highlight) return false;
  if (highlight.type === "none") return false;
  if (!highlight.title?.trim()) return false;
  if (!highlight.text?.trim()) return false;
  if (options.requireImage && !highlight.image?.trim()) return false;

  return true;
}

async function loadState(): Promise<PoolState> {
  const [validRows, allRows]: [ValidCacheRow[], { day: string }[]] =
    await Promise.all([
      prisma.dayHighlightCache.findMany({
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
        },
      }),
      prisma.dayHighlightCache.findMany({
        select: {
          day: true,
        },
      }),
    ]);

  const state: PoolState = {
    validDays: new Set(validRows.map((row) => row.day)),
    cachedDays: new Set(allRows.map((row) => row.day)),
    monthUsage: new Map<number, number>(),
    monthDayUsage: new Map<string, number>(),
    yearUsage: new Map<number, number>(),
    decadeUsage: new Map<number, number>(),
    centuryUsage: new Map<number, number>(),
  };

  for (const row of validRows) {
    const year = getYear(row.day);
    const month = getMonth(row.day);
    const monthDay = getMonthDay(row.day);
    const decade = getDecade(year);
    const century = getCentury(year);

    increment(state.monthUsage, month);
    increment(state.monthDayUsage, monthDay);
    increment(state.yearUsage, year);
    increment(state.decadeUsage, decade);
    increment(state.centuryUsage, century);
  }

  return state;
}

function pickMonth(state: PoolState, target: number) {
  const targetPerMonth = Math.ceil(target / 12);

  const options = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const count = state.monthUsage.get(month) ?? 0;

    let weight = 1 / Math.pow(count + 1, 2.4);

    if (month === 4) {
      weight *= 0.0001;
    }

    if (count >= targetPerMonth) {
      weight *= 0.05;
    }

    return {
      value: month,
      weight,
    };
  });

  return weightedPick(options);
}

function pickMonthDay(month: number, state: PoolState, target: number) {
  const targetPerMonthDay = Math.max(1, Math.ceil(target / 366));
  const templates = getMonthDayTemplatesForMonth(month);

  const options = templates.map((monthDay) => {
    const count = state.monthDayUsage.get(monthDay) ?? 0;

    let weight = 1 / Math.pow(count + 1, 2.2);

    if (count >= targetPerMonthDay) {
      weight *= 0.12;
    }

    if (monthDay === "04-27" || monthDay === "04-28") {
      weight *= 0.00001;
    }

    return {
      value: monthDay,
      weight,
    };
  });

  return weightedPick(options);
}

function pickYearForMonthDay(monthDay: string, state: PoolState, args: Args) {
  const [monthRaw, dayRaw] = monthDay.split("-");
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  const years: number[] = [];

  for (let year = args.minYear; year <= args.maxYear; year += 1) {
    if (!isValidForMonthDay(year, month, day)) continue;

    const candidate = `${year}-${monthDay}`;

    if (state.cachedDays.has(candidate)) continue;

    years.push(year);
  }

  if (years.length === 0) return null;

  const options = shuffleArray(years).map((year) => {
    const decade = getDecade(year);
    const century = getCentury(year);

    const yearCount = state.yearUsage.get(year) ?? 0;
    const decadeCount = state.decadeUsage.get(decade) ?? 0;
    const centuryCount = state.centuryUsage.get(century) ?? 0;

    let weight = 1;

    weight *= 1 / Math.pow(yearCount + 1, 2.2);
    weight *= 1 / Math.pow(decadeCount + 1, 0.7);
    weight *= 1 / Math.pow(centuryCount + 1, 0.25);

    if (year >= 1900 && year <= 1999) weight *= 1.15;
    if (year >= 2000) weight *= 0.85;
    if (year < 1900) weight *= 0.25;

    return {
      value: year,
      weight,
    };
  });

  return weightedPick(options);
}

function updateStateForAddedDay(day: string, state: PoolState) {
  const year = getYear(day);
  const month = getMonth(day);
  const monthDay = getMonthDay(day);
  const decade = getDecade(year);
  const century = getCentury(year);

  state.validDays.add(day);
  state.cachedDays.add(day);

  increment(state.monthUsage, month);
  increment(state.monthDayUsage, monthDay);
  increment(state.yearUsage, year);
  increment(state.decadeUsage, decade);
  increment(state.centuryUsage, century);
}

function printSummary(state: PoolState) {
  const months = [...state.monthUsage.entries()].sort((a, b) => a[0] - b[0]);
  const topMonthDays = [...state.monthDayUsage.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20);
  const centuries = [...state.centuryUsage.entries()].sort((a, b) => a[0] - b[0]);

  console.log("\nCurrent valid days:", state.validDays.size);

  console.log("\nmonths");
  for (const [month, count] of months) {
    console.log(`${pad2(month)}: ${count}`);
  }

  console.log("\ntop month-days");
  for (const [monthDay, count] of topMonthDays) {
    console.log(`${monthDay}: ${count}`);
  }

  console.log("\ncenturies");
  for (const [century, count] of centuries) {
    console.log(`${century}: ${count}`);
  }
}

async function main() {
  const args = parseArgs();
  const state = await loadState();

  console.log("=== EXPAND SURPRISE POOL V2 ===");
  console.log("target:", args.target);
  console.log("maxAdded:", args.maxAdded);
  console.log("maxAttempts:", args.maxAttempts);
  console.log("delayMs:", args.delayMs);
  console.log("minYear:", args.minYear);
  console.log("maxYear:", args.maxYear);
  console.log("requireImage:", args.requireImage);
  console.log("starting valid days:", state.validDays.size);

  if (state.validDays.size >= args.target) {
    console.log("Pool already reached target. Nothing to do.");
    printSummary(state);
    return;
  }

  let added = 0;
  let attempts = 0;
  let failed = 0;
  let unusable = 0;
  let noCandidate = 0;

  while (
    state.validDays.size < args.target &&
    added < args.maxAdded &&
    attempts < args.maxAttempts
  ) {
    const month = pickMonth(state, args.target);

    if (!month) {
      noCandidate += 1;
      continue;
    }

    const monthDay = pickMonthDay(month, state, args.target);

    if (!monthDay) {
      noCandidate += 1;
      continue;
    }

    const year = pickYearForMonthDay(monthDay, state, args);

    if (!year) {
      noCandidate += 1;
      state.monthDayUsage.set(
        monthDay,
        (state.monthDayUsage.get(monthDay) ?? 0) + 1
      );
      continue;
    }

    const candidate = `${year}-${monthDay}`;
    attempts += 1;

    console.log(
      `[${attempts}/${args.maxAttempts}] probing ${candidate} ` +
        `(added ${added}/${args.maxAdded}, valid ${state.validDays.size}/${args.target})`
    );

    try {
      const result = await ensureHighlightsForDay(candidate);
      state.cachedDays.add(candidate);

      if (!isUsableHighlight(result, { requireImage: args.requireImage })) {
        unusable += 1;
        console.log("  skip: no usable highlight");
      } else {
        updateStateForAddedDay(candidate, state);
        added += 1;

        const title = result.highlight?.title ?? "Untitled";
        console.log(`  added: ${title}`);
      }
    } catch (error) {
      failed += 1;
      console.warn(`  failed: ${candidate}`, error);
    }

    if (args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  console.log("\n=== DONE ===");
  console.log("added:", added);
  console.log("attempts:", attempts);
  console.log("unusable:", unusable);
  console.log("failed:", failed);
  console.log("noCandidate:", noCandidate);
  console.log("final valid days:", state.validDays.size);

  printSummary(state);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
