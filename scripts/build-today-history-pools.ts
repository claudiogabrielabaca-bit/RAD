import { prisma } from "../src/app/lib/prisma";
import { ensureHighlightsForDay } from "../src/app/lib/highlight-service";

const BATCH_SIZE = 4;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isUsableHighlight(
  result: Awaited<ReturnType<typeof ensureHighlightsForDay>>
) {
  const primary = result.highlight ?? result.highlights?.[0] ?? null;

  return !!(
    primary &&
    primary.type !== "none" &&
    primary.text &&
    primary.text.trim().length > 0
  );
}

function getValidYearsForMonthDay(month: number, day: number) {
  const minYear = 1800;
  const maxYear = new Date().getFullYear();
  const years: number[] = [];

  for (let year = minYear; year <= maxYear; year++) {
    if (month === 2 && day === 29 && !isLeapYear(year)) {
      continue;
    }

    years.push(year);
  }

  return years;
}

function getAllMonthDays() {
  const result: string[] = [];

  for (let month = 1; month <= 12; month++) {
    const maxDay =
      month === 2
        ? 29
        : [4, 6, 9, 11].includes(month)
          ? 30
          : 31;

    for (let day = 1; day <= maxDay; day++) {
      result.push(`${pad2(month)}-${pad2(day)}`);
    }
  }

  return result;
}

function parseMonthDayArg(value: string) {
  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    throw new Error("Use MM-DD format, for example: 04-10");
  }

  return value;
}

async function buildPoolForMonthDay(monthDay: string) {
  const [month, day] = monthDay.split("-").map(Number);
  const years = getValidYearsForMonthDay(month, day);
  const candidateDays = years.map((year) => `${year}-${monthDay}`);

  const validDays: string[] = [];

  for (let i = 0; i < candidateDays.length; i += BATCH_SIZE) {
    const batch = candidateDays.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (candidate) => {
        const result = await ensureHighlightsForDay(candidate);

        if (isUsableHighlight(result)) {
          return candidate;
        }

        return null;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        validDays.push(result.value);
      }
    }

    console.log(
      `[${monthDay}] checked ${Math.min(i + BATCH_SIZE, candidateDays.length)}/${candidateDays.length} | valid ${validDays.length}`
    );
  }

  await prisma.todayHistoryPool.upsert({
    where: {
      monthDay,
    },
    update: {
      validDays,
      validCount: validDays.length,
    },
    create: {
      monthDay,
      validDays,
      validCount: validDays.length,
    },
  });

  console.log(`[${monthDay}] saved ${validDays.length} valid years`);
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log("Usage:");
    console.log("  npx tsx .\\scripts\\build-today-history-pools.ts 04-10");
    console.log("  npx tsx .\\scripts\\build-today-history-pools.ts --all");
    process.exit(1);
  }

  const monthDays = arg === "--all" ? getAllMonthDays() : [parseMonthDayArg(arg)];

  for (const monthDay of monthDays) {
    await buildPoolForMonthDay(monthDay);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });