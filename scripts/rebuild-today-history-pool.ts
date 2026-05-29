import { prisma } from "../src/app/lib/prisma";
import { ensureHighlightsForDay } from "../src/app/lib/highlight-service";

const EMPTY_FALLBACK_TEXT = "No exact historical match was found for this date.";
const MIN_YEAR = 1800;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isValidMonthDay(value: string) {
  return /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);
}

function getMonthDayFromOffset(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getAllMonthDays() {
  const monthDays: string[] = [];

  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(2024, month - 1, day);

      if (date.getMonth() !== month - 1) continue;

      monthDays.push(`${pad2(month)}-${pad2(day)}`);
    }
  }

  return monthDays;
}

function getCandidateDays(monthDay: string) {
  const [month, day] = monthDay.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const candidates: string[] = [];

  for (let year = MIN_YEAR; year <= currentYear; year += 1) {
    if (month === 2 && day === 29 && !isLeapYear(year)) continue;

    candidates.push(`${year}-${pad2(month)}-${pad2(day)}`);
  }

  return candidates;
}

function isUsableHighlight(
  result: Awaited<ReturnType<typeof ensureHighlightsForDay>>
) {
  const primary = result.highlight ?? result.highlights?.[0] ?? null;

  return !!(
    primary &&
    primary.type !== "none" &&
    primary.title?.trim() &&
    primary.text?.trim() &&
    primary.text.trim() !== EMPTY_FALLBACK_TEXT
  );
}

function resolveMonthDays(arg?: string): string[] {
  if (!arg || arg === "today") return [getMonthDayFromOffset(0)];
  if (arg === "tomorrow") return [getMonthDayFromOffset(1)];
  if (arg === "today-and-tomorrow") {
    return Array.from(new Set([getMonthDayFromOffset(0), getMonthDayFromOffset(1)]));
  }
  if (arg === "all") return getAllMonthDays();
  if (isValidMonthDay(arg)) return [arg];

  throw new Error(
    `Invalid month-day argument "${arg}". Use MM-DD, today, tomorrow, today-and-tomorrow, or all.`
  );
}

async function rebuildMonthDay(monthDay: string) {
  const candidates = getCandidateDays(monthDay);
  const usableDays: string[] = [];
  const unusableDays: string[] = [];

  console.log("");
  console.log(`Rebuilding Today in History pool ${monthDay}`);
  console.log(`Candidate days: ${candidates.length}`);

  for (const candidate of candidates) {
    try {
      const result = await ensureHighlightsForDay(candidate);

      if (isUsableHighlight(result)) {
        usableDays.push(candidate);
        console.log(`+ ${candidate} (${usableDays.length})`);
      } else {
        unusableDays.push(candidate);
        console.log(`- ${candidate}`);
      }
    } catch (error) {
      unusableDays.push(candidate);
      console.warn(
        `! ${candidate}`,
        error instanceof Error ? error.message : error
      );
    }
  }

  const finalDays = Array.from(new Set(usableDays)).sort();

  await prisma.todayHistoryPool.upsert({
    where: { monthDay },
    update: {
      validDays: finalDays,
      validCount: finalDays.length,
    },
    create: {
      monthDay,
      validDays: finalDays,
      validCount: finalDays.length,
    },
  });

  console.log("");
  console.log(`Done ${monthDay}`);
  console.log(`Usable days: ${finalDays.length}`);
  console.log(`Unusable days: ${unusableDays.length}`);

  return {
    monthDay,
    usable: finalDays.length,
    unusable: unusableDays.length,
    total: candidates.length,
  };
}

async function main() {
  const arg = process.argv[2];
  const monthDays = resolveMonthDays(arg);

  console.log(`Mode: ${arg ?? "today"}`);
  console.log(`Month-days to rebuild: ${monthDays.join(", ")}`);

  const summary = [];

  for (const monthDay of monthDays) {
    summary.push(await rebuildMonthDay(monthDay));
  }

  console.log("");
  console.log("Summary");
  console.table(summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
