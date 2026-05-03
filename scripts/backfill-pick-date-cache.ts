import { prisma } from "@/app/lib/prisma";
import { isValidDayString } from "@/app/lib/day";
import {
  generatePickDateCacheForDay,
  upsertPickDateCacheEntry,
  PICK_DATE_EMPTY_TEXT,
  type PickDateCacheEntry,
} from "@/app/lib/pick-date-cache";

type Args = {
  from: string;
  to: string;
  limit: number;
  offset: number;
  delayMs: number;
  retryDelayMs: number;
  retries: number;
  dryRun: boolean;
  refresh: boolean;
  onlyFailed: boolean;
};

type AttemptResult = Awaited<ReturnType<typeof generatePickDateCacheForDay>>;

const DEFAULT_SOURCE = "wiki_on_this_day";

function parseArgs(): Args {
  const raw = new Map<string, string | boolean>();

  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;

    const [key, value] = arg.slice(2).split("=");
    raw.set(key, value ?? true);
  }

  const from = String(raw.get("from") ?? "1990-01-01");
  const to = String(raw.get("to") ?? "2016-12-31");
  const limit = Number(raw.get("limit") ?? 500);
  const offset = Number(raw.get("offset") ?? 0);
  const delayMs = Number(raw.get("delayMs") ?? 2500);
  const retryDelayMs = Number(raw.get("retryDelayMs") ?? 8000);
  const retries = Number(raw.get("retries") ?? 2);
  const dryRun = raw.has("dryRun");
  const refresh = raw.has("refresh");
  const onlyFailed = raw.has("onlyFailed");

  if (!isValidDayString(from)) {
    throw new Error(`Invalid --from value: ${from}`);
  }

  if (!isValidDayString(to)) {
    throw new Error(`Invalid --to value: ${to}`);
  }

  if (from > to) {
    throw new Error("--from must be before or equal to --to");
  }

  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive number");
  }

  if (!Number.isFinite(offset) || offset < 0) {
    throw new Error("--offset must be zero or a positive number");
  }

  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error("--delayMs must be zero or a positive number");
  }

  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new Error("--retryDelayMs must be zero or a positive number");
  }

  if (!Number.isFinite(retries) || retries < 0) {
    throw new Error("--retries must be zero or a positive number");
  }

  return {
    from,
    to,
    limit,
    offset,
    delayMs,
    retryDelayMs,
    retries: Math.floor(retries),
    dryRun,
    refresh,
    onlyFailed,
  };
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function buildDays(from: string, to: string) {
  const days: string[] = [];
  let cursor = from;

  while (cursor <= to) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildScriptFailedEntry(day: string, error: unknown): PickDateCacheEntry {
  const year = Number(day.slice(0, 4));

  return {
    day,
    status: "failed",
    type: "none",
    year,
    title: null,
    text: PICK_DATE_EMPTY_TEXT,
    image: null,
    articleUrl: null,
    highlights: [],
    source: DEFAULT_SOURCE,
    qualityScore: 0,
    lastError:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown backfill error",
  };
}

async function getSelectedDays(args: Args) {
  if (!args.onlyFailed) {
    return buildDays(args.from, args.to).slice(
      args.offset,
      args.offset + args.limit
    );
  }

  const rows = await prisma.pickDateCache.findMany({
    where: {
      status: "failed",
      day: {
        gte: args.from,
        lte: args.to,
      },
    },
    select: {
      day: true,
    },
    orderBy: {
      day: "asc",
    },
    skip: args.offset,
    take: args.limit,
  });

  return rows.map((row) => row.day);
}

async function generateWithRetries(day: string, args: Args) {
  let lastResult: AttemptResult | null = null;
  let lastError: unknown = null;

  const maxAttempts = args.retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await generatePickDateCacheForDay(day, {
        /*
         * Important:
         * We always dry-run individual attempts here and write only once,
         * after the final selected result. This avoids saving temporary
         * failed rows before retries are exhausted.
         */
        dryRun: true,
        refresh: args.refresh || args.onlyFailed || attempt > 1,
      });

      lastResult = result;

      if (result.skippedExisting) {
        return result;
      }

      if (result.entry.status !== "failed") {
        return result;
      }

      if (attempt < maxAttempts) {
        console.log(
          `  retry ${attempt}/${args.retries}: ${result.entry.lastError ?? "failed"}`
        );

        if (args.retryDelayMs > 0) {
          await sleep(args.retryDelayMs);
        }
      }
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        console.log(
          `  retry ${attempt}/${args.retries}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );

        if (args.retryDelayMs > 0) {
          await sleep(args.retryDelayMs);
        }
      }
    }
  }

  if (lastResult) {
    return lastResult;
  }

  return {
    entry: buildScriptFailedEntry(day, lastError),
    skippedExisting: false,
  };
}

async function main() {
  const args = parseArgs();
  const days = await getSelectedDays(args);

  let ready = 0;
  let noMatch = 0;
  let failed = 0;
  let skippedExisting = 0;
  let written = 0;

  console.log("=== BACKFILL PICK DATE CACHE ===");
  console.log("version: v1-pick-date-cache");
  console.log("from:", args.from);
  console.log("to:", args.to);
  console.log("offset:", args.offset);
  console.log("limit:", args.limit);
  console.log("selected days:", days.length);
  console.log("delayMs:", args.delayMs);
  console.log("retryDelayMs:", args.retryDelayMs);
  console.log("retries:", args.retries);
  console.log("dryRun:", args.dryRun);
  console.log("refresh:", args.refresh);
  console.log("onlyFailed:", args.onlyFailed);
  console.log("");

  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    const label = `[${index + 1}/${days.length}] ${day}`;

    try {
      const result = await generateWithRetries(day, args);
      const entry = result.entry;

      if (result.skippedExisting) {
        skippedExisting += 1;
      } else if (!args.dryRun) {
        await upsertPickDateCacheEntry(entry);
        written += 1;
      }

      if (entry.status === "ready") ready += 1;
      else if (entry.status === "no_match") noMatch += 1;
      else failed += 1;

      console.log(
        `${label} ${entry.status} q=${entry.qualityScore} source=${entry.source}${
          result.skippedExisting ? " skipped-existing" : ""
        }${entry.title ? ` - ${entry.title}` : ""}${
          entry.status === "failed" && entry.lastError
            ? ` | ${entry.lastError}`
            : ""
        }`
      );
    } catch (error) {
      const entry = buildScriptFailedEntry(day, error);

      failed += 1;

      if (!args.dryRun) {
        await upsertPickDateCacheEntry(entry);
        written += 1;
      }

      console.error(
        `${label} failed`,
        error instanceof Error ? error.message : error
      );
    }

    if (args.delayMs > 0 && index + 1 < days.length) {
      await sleep(args.delayMs);
    }
  }

  console.log("\n=== DONE ===");
  console.log("selected:", days.length);
  console.log("ready:", ready);
  console.log("no_match:", noMatch);
  console.log("failed:", failed);
  console.log("skipped existing:", skippedExisting);
  console.log("written:", written);

  const totals = await prisma.pickDateCache.groupBy({
    by: ["status"],
    _count: {
      _all: true,
    },
  });

  console.log("\ncache totals");
  for (const row of totals.sort((a, b) => a.status.localeCompare(b.status))) {
    console.log(`${row.status}: ${row._count._all}`);
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