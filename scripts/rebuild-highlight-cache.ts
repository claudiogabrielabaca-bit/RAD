import { prisma } from "../src/app/lib/prisma";
import { getDayHighlights } from "../src/app/lib/wiki";

const START_YEAR = 1800;
const END_YEAR = new Date().getFullYear();
const MAX_PER_MONTH_DAY = 6;
const MAX_PER_YEAR = 2;
const BATCH_LOG_EVERY = 25;
const REQUEST_DELAY_MS = 120;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffleArray(items: string[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function buildMonthDaySeedDates() {
  const dates: string[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const maxDay = getDaysInMonth(2000, month);

    for (let day = 1; day <= maxDay; day += 1) {
      dates.push(`2000-${pad2(month)}-${pad2(day)}`);
    }
  }

  return shuffleArray(dates);
}

async function wipeExistingData() {
  await prisma.$transaction([
    prisma.surpriseDeck.deleteMany({}),
    prisma.dayHighlightCache.deleteMany({}),
  ]);
}

async function seedMonthDayCoverage() {
  const seedDates = buildMonthDaySeedDates();
  let processed = 0;

  for (const date of seedDates) {
    try {
      await getDayHighlights(date);
      processed += 1;

      if (processed % BATCH_LOG_EVERY === 0) {
        console.log(`[seed] processed ${processed}/${seedDates.length} - ${date}`);
      }
    } catch (error) {
      console.error(`[seed] failed ${date}`, error);
    }

    await sleep(REQUEST_DELAY_MS);
  }
}

async function getCachedMonthDaysNeedingBackfill() {
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

  const counts = new Map<string, number>();

  for (const row of rows) {
    const monthDay = row.day.slice(5, 10);
    counts.set(monthDay, (counts.get(monthDay) ?? 0) + 1);
  }

  const targets: string[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const maxDay = getDaysInMonth(2000, month);

    for (let day = 1; day <= maxDay; day += 1) {
      const monthDay = `${pad2(month)}-${pad2(day)}`;
      const count = counts.get(monthDay) ?? 0;

      if (count < MAX_PER_MONTH_DAY) {
        targets.push(monthDay);
      }
    }
  }

  return shuffleArray(targets);
}

function buildBalancedYears() {
  const years: number[] = [];

  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    years.push(year);
  }

  const buckets = {
    nineteenth: years.filter((year) => year >= 1800 && year <= 1899),
    twentieth: years.filter((year) => year >= 1900 && year <= 1999),
    twentyFirst: years.filter((year) => year >= 2000),
  };

  const shuffled = {
    nineteenth: shuffleArray(buckets.nineteenth.map(String)).map(Number),
    twentieth: shuffleArray(buckets.twentieth.map(String)).map(Number),
    twentyFirst: shuffleArray(buckets.twentyFirst.map(String)).map(Number),
  };

  const result: number[] = [];

  while (
    shuffled.nineteenth.length ||
    shuffled.twentieth.length ||
    shuffled.twentyFirst.length
  ) {
    if (shuffled.twentieth.length) result.push(shuffled.twentieth.shift()!);
    if (shuffled.nineteenth.length) result.push(shuffled.nineteenth.shift()!);
    if (shuffled.twentyFirst.length) result.push(shuffled.twentyFirst.shift()!);
  }

  return result;
}

async function backfillBalancedYears() {
  const targets = await getCachedMonthDaysNeedingBackfill();
  const years = buildBalancedYears();
  const yearUsage = new Map<number, number>();
  let processed = 0;

  for (const monthDay of targets) {
    const [month, day] = monthDay.split("-");
    let filled = 0;

    for (const year of years) {
      if ((yearUsage.get(year) ?? 0) >= MAX_PER_YEAR) {
        continue;
      }

      const date = `${year}-${month}-${day}`;

      try {
        const highlights = await getDayHighlights(date);
        const usable = highlights.some((item) => item.type !== "none");

        if (usable) {
          yearUsage.set(year, (yearUsage.get(year) ?? 0) + 1);
          filled += 1;
          processed += 1;

          if (processed % BATCH_LOG_EVERY === 0) {
            console.log(`[backfill] processed ${processed} - ${date}`);
          }
        }
      } catch (error) {
        console.error(`[backfill] failed ${date}`, error);
      }

      await sleep(REQUEST_DELAY_MS);

      if (filled >= MAX_PER_MONTH_DAY) {
        break;
      }
    }
  }
}

async function main() {
  console.log("Wiping existing highlight cache and surprise decks...");
  await wipeExistingData();

  console.log("Seeding one pass for all month-days...");
  await seedMonthDayCoverage();

  console.log("Backfilling missing / weak month-days with balanced years...");
  await backfillBalancedYears();

  console.log("Done rebuilding highlight cache.");
}

main()
  .catch((error) => {
    console.error("rebuild-highlight-cache failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
