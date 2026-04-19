import { prisma } from "../src/app/lib/prisma";
import { ensureHighlightsForDay } from "../src/app/lib/highlight-service";

type CachedRow = {
  day: string;
  title: string | null;
  type: string;
};

type BatchResult = {
  day: string;
  usable: boolean;
  title: string | null;
  type: string | null;
};

type UsableDay = {
  day: string;
  title: string | null;
  type: string | null;
  source: "cache" | "generated";
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getValidYearsForMonthDay(month: number, day: number) {
  const minYear = 1800;
  const maxYear = new Date().getFullYear();
  const years: number[] = [];

  for (let year = minYear; year <= maxYear; year++) {
    if (month === 2 && day === 29 && !isLeapYear(year)) continue;
    years.push(year);
  }

  return years;
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

async function main() {
  const monthDayArg = process.argv[2] ?? "04-10";

  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(monthDayArg)) {
    throw new Error("Use MM-DD format, for example: 04-10");
  }

  const [month, day] = monthDayArg.split("-").map(Number);
  const years = getValidYearsForMonthDay(month, day);
  const candidateDays: string[] = years.map(
    (year) => `${year}-${pad2(month)}-${pad2(day)}`
  );

  console.log(`Month-day: ${monthDayArg}`);
  console.log(`Candidate years: ${years.length}`);
  console.log("");

  const cachedRows: CachedRow[] = await prisma.dayHighlightCache.findMany({
    where: {
      day: {
        endsWith: `-${pad2(month)}-${pad2(day)}`,
      },
      type: {
        not: "none",
      },
      title: {
        not: null,
      },
      text: {
        not: "",
      },
    },
    select: {
      day: true,
      title: true,
      type: true,
    },
    orderBy: {
      day: "asc",
    },
  });

  console.log(`Cached valid rows: ${cachedRows.length}`);
  console.log("");

  const usableDays: UsableDay[] = [];
  const unusableDays: string[] = [];

  const BATCH_SIZE = 4;

  for (let i = 0; i < candidateDays.length; i += BATCH_SIZE) {
    const batch = candidateDays.slice(i, i + BATCH_SIZE);

    const results: BatchResult[] = await Promise.all(
      batch.map(async (candidate: string): Promise<BatchResult> => {
        try {
          const result = await ensureHighlightsForDay(candidate);
          const primary = result.highlight ?? result.highlights?.[0] ?? null;

          if (isUsableHighlight(result)) {
            return {
              day: candidate,
              usable: true,
              title: primary?.title ?? null,
              type: primary?.type ?? null,
            };
          }

          return {
            day: candidate,
            usable: false,
            title: null,
            type: null,
          };
        } catch {
          return {
            day: candidate,
            usable: false,
            title: null,
            type: null,
          };
        }
      })
    );

    for (const item of results) {
      if (item.usable) {
        const source = cachedRows.some((row: CachedRow) => row.day === item.day)
          ? "cache"
          : "generated";

        usableDays.push({
          day: item.day,
          title: item.title,
          type: item.type,
          source,
        });
      } else {
        unusableDays.push(item.day);
      }
    }

    console.log(
      `Checked ${Math.min(i + BATCH_SIZE, candidateDays.length)}/${candidateDays.length}`
    );
  }

  console.log("");
  console.log("===== SUMMARY =====");
  console.log(`Month-day: ${monthDayArg}`);
  console.log(`Candidate years total: ${candidateDays.length}`);
  console.log(`Usable years total: ${usableDays.length}`);
  console.log(`Unusable years total: ${unusableDays.length}`);
  console.log(`Cached valid rows: ${cachedRows.length}`);
  console.log("");

  console.log("===== USABLE YEARS =====");
  for (const item of usableDays) {
    console.log(
      `${item.day} | ${item.type ?? "unknown"} | ${item.source} | ${item.title ?? "(no title)"}`
    );
  }

  console.log("");
  console.log("===== UNUSABLE YEARS =====");
  for (const dayValue of unusableDays) {
    console.log(dayValue);
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