import { prisma } from "@/app/lib/prisma";
import { ensureHighlightsForDay } from "@/app/lib/highlight-service";

const MIN_YEAR = 1800;
const MAX_YEAR = new Date().getFullYear();

const TARGET_PER_MONTH_DAY = 4;
const MAX_PER_YEAR = 16;
const MAX_PER_DECADE = 160;
const MAX_PROBES_PER_MONTH_DAY = 120;

type DayRow = {
  day: string;
};

type RebuildState = {
  monthDayUsage: Map<string, number>;
  yearUsage: Map<number, number>;
  decadeUsage: Map<number, number>;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

function getMonthDayTemplates() {
  const templates: string[] = [];

  for (let month = 1; month <= 12; month++) {
    const maxDay = new Date(2024, month, 0).getDate();

    for (let day = 1; day <= maxDay; day++) {
      templates.push(`${pad2(month)}-${pad2(day)}`);
    }
  }

  return templates;
}

function isUsableHighlight(
  result: Awaited<ReturnType<typeof ensureHighlightsForDay>>
) {
  const highlight = result.highlight;

  return !!(
    highlight &&
    highlight.type !== "none" &&
    highlight.title &&
    highlight.title.trim().length > 0 &&
    highlight.text &&
    highlight.text.trim().length > 0
  );
}

async function wipeExistingData() {
  console.log("Wiping existing highlight cache and surprise decks...");

  const deletedCache = await prisma.dayHighlightCache.deleteMany({});
  const deletedDecks = await prisma.surpriseDeck.deleteMany({});

  console.log(`Deleted ${deletedCache.count} day highlight cache rows`);
  console.log(`Deleted ${deletedDecks.count} surprise decks`);
}

async function getExistingCounts(): Promise<RebuildState> {
  const rows: DayRow[] = await prisma.dayHighlightCache.findMany({
    select: { day: true },
  });

  const monthDayUsage = new Map<string, number>();
  const yearUsage = new Map<number, number>();
  const decadeUsage = new Map<number, number>();

  for (const row of rows) {
    const year = Number(row.day.slice(0, 4));
    const monthDay = row.day.slice(5, 10);
    const decade = getDecade(year);

    monthDayUsage.set(monthDay, (monthDayUsage.get(monthDay) ?? 0) + 1);
    yearUsage.set(year, (yearUsage.get(year) ?? 0) + 1);
    decadeUsage.set(decade, (decadeUsage.get(decade) ?? 0) + 1);
  }

  return { monthDayUsage, yearUsage, decadeUsage };
}

function buildCandidateYearsForMonthDay(month: number, day: number) {
  const years: number[] = [];

  for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
    if (month === 2 && day === 29 && !isLeapYear(year)) {
      continue;
    }

    years.push(year);
  }

  return years;
}

function scoreYear(
  year: number,
  yearUsage: Map<number, number>,
  decadeUsage: Map<number, number>
) {
  const yearCount = yearUsage.get(year) ?? 0;
  const decadeCount = decadeUsage.get(getDecade(year)) ?? 0;
  const modernPenalty = year >= 2000 ? 1 : 0;

  return yearCount * 1000 + decadeCount * 10 + modernPenalty;
}

async function fillMonthDay(monthDay: string, state: RebuildState) {
  const existing = state.monthDayUsage.get(monthDay) ?? 0;

  if (existing >= TARGET_PER_MONTH_DAY) {
    return { added: 0, attempts: 0 };
  }

  const [monthStr, dayStr] = monthDay.split("-");
  const month = Number(monthStr);
  const day = Number(dayStr);

  const existingRows: DayRow[] = await prisma.dayHighlightCache.findMany({
    where: {
      day: {
        endsWith: `-${monthDay}`,
      },
    },
    select: {
      day: true,
    },
  });

  const existingDays = new Set<string>(
    existingRows.map((row: DayRow) => row.day)
  );

  const candidateYears = buildCandidateYearsForMonthDay(month, day)
    .filter((year) => {
      if ((state.yearUsage.get(year) ?? 0) >= MAX_PER_YEAR) return false;
      if ((state.decadeUsage.get(getDecade(year)) ?? 0) >= MAX_PER_DECADE) {
        return false;
      }

      const iso = `${year}-${monthDay}`;
      return !existingDays.has(iso);
    })
    .sort(
      (a, b) =>
        scoreYear(a, state.yearUsage, state.decadeUsage) -
        scoreYear(b, state.yearUsage, state.decadeUsage)
    );

  let added = 0;
  let attempts = 0;

  for (const year of shuffleArray(candidateYears)) {
    if ((state.monthDayUsage.get(monthDay) ?? 0) >= TARGET_PER_MONTH_DAY) {
      break;
    }

    if (attempts >= MAX_PROBES_PER_MONTH_DAY) {
      break;
    }

    attempts += 1;
    const iso = `${year}-${monthDay}`;

    try {
      const result = await ensureHighlightsForDay(iso);

      if (!isUsableHighlight(result)) {
        continue;
      }

      const nowExisting = await prisma.dayHighlightCache.findFirst({
        where: { day: iso },
        select: { day: true },
      });

      if (!nowExisting) {
        continue;
      }

      existingDays.add(iso);
      added += 1;
      state.monthDayUsage.set(
        monthDay,
        (state.monthDayUsage.get(monthDay) ?? 0) + 1
      );
      state.yearUsage.set(year, (state.yearUsage.get(year) ?? 0) + 1);
      state.decadeUsage.set(
        getDecade(year),
        (state.decadeUsage.get(getDecade(year)) ?? 0) + 1
      );
    } catch (error) {
      console.warn(`Failed generating ${iso}:`, error);
    }
  }

  return { added, attempts };
}

async function main() {
  await wipeExistingData();

  const state = await getExistingCounts();
  const monthDays = getMonthDayTemplates();

  console.log(`Target per MM-DD: ${TARGET_PER_MONTH_DAY}`);
  console.log(`Total MM-DD templates: ${monthDays.length}`);
  console.log("Starting month-day targeted rebuild...");

  let totalAdded = 0;
  let totalAttempts = 0;

  for (let round = 1; round <= TARGET_PER_MONTH_DAY; round++) {
    console.log(`\n=== Round ${round}/${TARGET_PER_MONTH_DAY} ===`);

    for (const monthDay of shuffleArray(monthDays)) {
      const current = state.monthDayUsage.get(monthDay) ?? 0;

      if (current >= round) {
        continue;
      }

      const result = await fillMonthDay(monthDay, state);
      totalAdded += result.added;
      totalAttempts += result.attempts;
    }
  }

  const rows: DayRow[] = await prisma.dayHighlightCache.findMany({
    select: { day: true },
  });

  const monthCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();
  const decadeCounts = new Map<number, number>();
  const monthDayCounts = new Map<string, number>();

  for (const row of rows) {
    const year = Number(row.day.slice(0, 4));
    const month = row.day.slice(5, 7);
    const monthDay = row.day.slice(5, 10);

    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    decadeCounts.set(
      getDecade(year),
      (decadeCounts.get(getDecade(year)) ?? 0) + 1
    );
    monthDayCounts.set(monthDay, (monthDayCounts.get(monthDay) ?? 0) + 1);
  }

  const summary = [...monthCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  const topYears = [...yearCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 20)
    .map(([year, count]) => ({ year, count }));

  const topDecades = [...decadeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 20)
    .map(([decade, count]) => ({ decade, count }));

  const weakestMonthDays = [...monthDayCounts.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([monthDay, count]) => ({ monthDay, count }));

  const strongestMonthDays = [...monthDayCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([monthDay, count]) => ({ monthDay, count }));

  const belowTarget = monthDays
    .map((monthDay) => ({
      monthDay,
      count: monthDayCounts.get(monthDay) ?? 0,
    }))
    .filter((item) => item.count < TARGET_PER_MONTH_DAY)
    .sort((a, b) => a.count - b.count || a.monthDay.localeCompare(b.monthDay));

  console.log(`\nTotal added this run: ${totalAdded}`);
  console.log(`Total generation attempts: ${totalAttempts}`);
  console.log(`Final cache rows: ${rows.length}`);

  console.log("\nSummary:");
  console.table(summary);

  console.log("Top years:");
  console.table(topYears);

  console.log("Top decades:");
  console.table(topDecades);

  console.log("Weakest month-days:");
  console.table(weakestMonthDays);

  console.log("Strongest month-days:");
  console.table(strongestMonthDays);

  console.log(
    `Month-days below target (${TARGET_PER_MONTH_DAY}): ${belowTarget.length}`
  );
  if (belowTarget.length > 0) {
    console.table(belowTarget.slice(0, 50));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });