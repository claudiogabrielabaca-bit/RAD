import { prisma } from "../src/app/lib/prisma";
import { getDayHighlights } from "../src/app/lib/wiki";

const START_YEAR = 1800;
const END_YEAR = new Date().getFullYear();

const TARGET_PER_MONTH = 42;
const MAX_PER_YEAR = 4;
const MAX_PER_DECADE = 32;
const MAX_PER_MONTH_DAY = 4;

const SEED_LOG_EVERY = 25;
const BACKFILL_LOG_EVERY = 25;

type State = {
  usedDates: Set<string>;
  monthCounts: Map<number, number>;
  yearUsage: Map<number, number>;
  decadeUsage: Map<number, number>;
  monthDayUsage: Map<string, number>;
  seeded: number;
  backfilled: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function incrementMapCount<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildMonthDayTemplates() {
  const templates: Array<{ month: number; day: number; monthDay: string }> = [];

  for (let month = 1; month <= 12; month += 1) {
    const maxDay = getDaysInMonth(2000, month);
    for (let day = 1; day <= maxDay; day += 1) {
      templates.push({
        month,
        day,
        monthDay: `${pad2(month)}-${pad2(day)}`,
      });
    }
  }

  return templates;
}

function getCandidateYearsForMonthDay(month: number, day: number) {
  const years: number[] = [];

  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    if (getDaysInMonth(year, month) >= day) {
      years.push(year);
    }
  }

  return years;
}

function buildInitialState(): State {
  return {
    usedDates: new Set<string>(),
    monthCounts: new Map<number, number>(),
    yearUsage: new Map<number, number>(),
    decadeUsage: new Map<number, number>(),
    monthDayUsage: new Map<string, number>(),
    seeded: 0,
    backfilled: 0,
  };
}

function registerSuccess(date: string, state: State) {
  const month = Number(date.slice(5, 7));
  const year = Number(date.slice(0, 4));
  const monthDay = date.slice(5, 10);

  state.usedDates.add(date);
  incrementMapCount(state.monthCounts, month);
  incrementMapCount(state.yearUsage, year);
  incrementMapCount(state.decadeUsage, getDecade(year));
  incrementMapCount(state.monthDayUsage, monthDay);
}

async function tryPopulateDate(date: string, state: State) {
  if (state.usedDates.has(date)) return false;

  const items = await getDayHighlights(date);
  const hasUseful = items.some((item) => item.type !== "none");

  if (!hasUseful) return false;

  registerSuccess(date, state);
  return true;
}

async function clearExistingData() {
  const [cacheResult, deckResult] = await prisma.$transaction([
    prisma.dayHighlightCache.deleteMany({}),
    prisma.surpriseDeck.deleteMany({}),
  ]);

  console.log(`Deleted ${cacheResult.count} day highlight cache rows`);
  console.log(`Deleted ${deckResult.count} surprise decks`);
}

function getYearScore(year: number, monthDay: string, state: State) {
  const yearCount = state.yearUsage.get(year) ?? 0;
  const decadeCount = state.decadeUsage.get(getDecade(year)) ?? 0;
  const monthDayCount = state.monthDayUsage.get(monthDay) ?? 0;

  if (yearCount >= MAX_PER_YEAR) return Number.POSITIVE_INFINITY;
  if (decadeCount >= MAX_PER_DECADE) return Number.POSITIVE_INFINITY;
  if (monthDayCount >= MAX_PER_MONTH_DAY) return Number.POSITIVE_INFINITY;

  const mildYear2000Penalty = year === 2000 ? 3 : 0;

  return yearCount * 100 + decadeCount * 12 + mildYear2000Penalty;
}

function getOrderedCandidateYears(month: number, day: number, monthDay: string, state: State) {
  const years = getCandidateYearsForMonthDay(month, day);

  const decades = Array.from(
    new Set(years.map((year) => getDecade(year)))
  );

  const orderedDecades = shuffleArray(decades).sort((a, b) => {
    const aCount = state.decadeUsage.get(a) ?? 0;
    const bCount = state.decadeUsage.get(b) ?? 0;
    return aCount - bCount;
  });

  const ordered: number[] = [];

  for (const decade of orderedDecades) {
    const yearsInDecade = shuffleArray(
      years.filter((year) => getDecade(year) === decade)
    ).sort((a, b) => getYearScore(a, monthDay, state) - getYearScore(b, monthDay, state));

    ordered.push(...yearsInDecade);
  }

  return ordered.filter((year) => Number.isFinite(getYearScore(year, monthDay, state)));
}

async function seedOnePassForAllMonthDays(state: State) {
  console.log("Seeding one pass for all month-days with capped years / decades...");

  const templates = buildMonthDayTemplates();

  for (const [index, template] of templates.entries()) {
    const candidateYears = getOrderedCandidateYears(
      template.month,
      template.day,
      template.monthDay,
      state
    );

    let success = false;

    for (const year of candidateYears.slice(0, 120)) {
      const date = `${year}-${template.monthDay}`;

      try {
        if (await tryPopulateDate(date, state)) {
          state.seeded += 1;
          success = true;

          if (state.seeded % SEED_LOG_EVERY === 0) {
            console.log(
              `[seed] processed ${state.seeded}/${templates.length} - ${date}`
            );
          }

          break;
        }
      } catch (error) {
        console.error(`[seed] failed ${date}`, error);
      }
    }

    if (!success && (index + 1) % 50 === 0) {
      console.log(
        `[seed] scanned ${index + 1}/${templates.length} templates, seeded ${state.seeded}`
      );
    }
  }
}

function getWeakMonths(state: State) {
  return Array.from({ length: 12 }, (_, index) => index + 1)
    .map((month) => ({
      month,
      count: state.monthCounts.get(month) ?? 0,
    }))
    .sort((a, b) => a.count - b.count);
}

function getBestMonthDayForMonth(month: number, state: State) {
  const templates = buildMonthDayTemplates()
    .filter((item) => item.month === month)
    .map((item) => ({
      ...item,
      usage: state.monthDayUsage.get(item.monthDay) ?? 0,
    }))
    .filter((item) => item.usage < MAX_PER_MONTH_DAY)
    .sort((a, b) => a.usage - b.usage);

  if (templates.length === 0) return null;

  const bestUsage = templates[0]?.usage ?? 0;
  const best = templates.filter((item) => item.usage === bestUsage);

  return shuffleArray(best)[0] ?? null;
}

async function backfillMissingOrWeakMonths(state: State) {
  console.log("Backfilling missing / weak months with balanced years...");

  let stalledRounds = 0;

  while (true) {
    const weakMonths = getWeakMonths(state);
    const weakest = weakMonths[0];

    if (!weakest || weakest.count >= TARGET_PER_MONTH) {
      break;
    }

    const target = getBestMonthDayForMonth(weakest.month, state);

    if (!target) {
      break;
    }

    const candidateYears = getOrderedCandidateYears(
      target.month,
      target.day,
      target.monthDay,
      state
    );

    let success = false;

    for (const year of candidateYears.slice(0, 160)) {
      const date = `${year}-${target.monthDay}`;

      if (state.usedDates.has(date)) {
        continue;
      }

      try {
        if (await tryPopulateDate(date, state)) {
          state.backfilled += 1;
          success = true;

          if (state.backfilled % BACKFILL_LOG_EVERY === 0) {
            console.log(
              `[backfill] processed ${state.backfilled} - ${date} | month ${pad2(
                weakest.month
              )} now ${state.monthCounts.get(weakest.month) ?? 0}`
            );
          }

          break;
        }
      } catch (error) {
        console.error(`[backfill] failed ${date}`, error);
      }
    }

    if (!success) {
      stalledRounds += 1;
      if (stalledRounds >= 60) {
        console.log("Backfill stalled; stopping early.");
        break;
      }
    } else {
      stalledRounds = 0;
    }
  }
}

async function main() {
  console.log("Wiping existing highlight cache and surprise decks...");
  await clearExistingData();

  const state = buildInitialState();

  await seedOnePassForAllMonthDays(state);
  await backfillMissingOrWeakMonths(state);

  console.log("Done rebuilding highlight cache.");
  console.log("Summary:");
  console.table(
    Array.from({ length: 12 }, (_, index) => index + 1).map((month) => ({
      month: pad2(month),
      count: state.monthCounts.get(month) ?? 0,
    }))
  );

  console.log("Top years:");
  console.table(
    [...state.yearUsage.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([year, count]) => ({ year, count }))
  );

  console.log("Top decades:");
  console.table(
    [...state.decadeUsage.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([decade, count]) => ({ decade, count }))
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Script error:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
