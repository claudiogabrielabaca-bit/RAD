import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMPTY_FALLBACK_TEXT = "No exact historical match was found for this date.";

type Args = {
  dryRun: boolean;
};

type TodayHistoryPoolRow = {
  monthDay: string;
  validDays: unknown;
};

type CachedHighlightRow = {
  day: string;
  type: string;
  title: string | null;
  text: string;
};

function parseArgs(): Args {
  const args: Args = {
    dryRun: false,
  };

  for (const raw of process.argv.slice(2)) {
    const key = raw.replace(/^--/, "");

    if (key === "dryRun") args.dryRun = true;
  }

  return args;
}

function isValidMonthDayString(value?: string | null): value is string {
  return !!value && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);
}

function isValidDayString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizePoolDays(raw: unknown, monthDay: string): string[] {
  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(
      raw.filter(
        (item): item is string =>
          typeof item === "string" &&
          isValidDayString(item) &&
          item.endsWith(`-${monthDay}`)
      )
    )
  ).sort();
}

function isUsableCachedRow(row: CachedHighlightRow) {
  return (
    row.type !== "none" &&
    !!row.title?.trim() &&
    !!row.text?.trim() &&
    row.text.trim() !== EMPTY_FALLBACK_TEXT
  );
}

function isConfirmedBadCachedRow(row: CachedHighlightRow) {
  return !isUsableCachedRow(row);
}

async function main() {
  const args = parseArgs();

  console.log("=== CLEAN TODAY HISTORY POOL CONSERVATIVE ===");
  console.log("dryRun:", args.dryRun);
  console.log("mode: remove confirmed bad only; keep unknown untested days");

  const rows: TodayHistoryPoolRow[] = await prisma.todayHistoryPool.findMany({
    select: {
      monthDay: true,
      validDays: true,
    },
    orderBy: {
      monthDay: "asc",
    },
  });

  let touchedPools = 0;
  let removedDays = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  let confirmedGoodKept = 0;
  let unknownKept = 0;

  for (const row of rows) {
    if (!isValidMonthDayString(row.monthDay)) continue;

    const before = normalizePoolDays(row.validDays, row.monthDay);
    totalBefore += before.length;

    if (before.length === 0) {
      totalAfter += 0;
      continue;
    }

    const cacheRows: CachedHighlightRow[] = await prisma.dayHighlightCache.findMany({
      where: {
        day: {
          in: before,
        },
      },
      select: {
        day: true,
        type: true,
        title: true,
        text: true,
      },
    });

    const cacheByDay = new Map(cacheRows.map((cacheRow) => [cacheRow.day, cacheRow]));

    const after = before.filter((day) => {
      const cacheRow = cacheByDay.get(day);

      // Important:
      // If the day has never been tested/cached, keep it.
      // It may still become usable later.
      if (!cacheRow) {
        unknownKept += 1;
        return true;
      }

      if (isConfirmedBadCachedRow(cacheRow)) {
        return false;
      }

      confirmedGoodKept += 1;
      return true;
    });

    const removed = before.length - after.length;

    totalAfter += after.length;

    if (removed === 0) continue;

    touchedPools += 1;
    removedDays += removed;

    console.log(
      `${row.monthDay}: ${before.length} -> ${after.length} removed confirmedBad=${removed}`
    );

    if (!args.dryRun) {
      await prisma.todayHistoryPool.update({
        where: {
          monthDay: row.monthDay,
        },
        data: {
          validDays: after,
          validCount: after.length,
        },
      });
    }
  }

  console.log("");
  console.log("pools checked:", rows.length);
  console.log("pools changed:", touchedPools);
  console.log("valid days before:", totalBefore);
  console.log("valid days after:", totalAfter);
  console.log("removed confirmed bad days:", removedDays);
  console.log("kept confirmed good days:", confirmedGoodKept);
  console.log("kept unknown untested days:", unknownKept);

  if (args.dryRun) {
    console.log("");
    console.log("Dry run only. No rows were changed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });