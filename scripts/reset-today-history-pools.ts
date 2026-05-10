import { prisma } from "../src/app/lib/prisma";
import {
  getFirstPositionalArg,
  requireScriptSafety,
} from "./lib/script-safety";

const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function printUsage() {
  console.log("Usage:");
  console.log(
    "  npx tsx .\\scripts\\reset-today-history-pools.ts --all --confirm"
  );
  console.log(
    "  npx tsx .\\scripts\\reset-today-history-pools.ts 03-02 --confirm"
  );
  console.log("");
  console.log("Production/Railway also requires:");
  console.log("  --allowProduction");
}

async function main() {
  const arg = getFirstPositionalArg();

  if (!arg) {
    printUsage();
    process.exit(1);
  }

  if (arg !== "--all" && !MONTH_DAY_RE.test(arg)) {
    throw new Error("Use MM-DD format, for example: 03-02, or --all");
  }

  requireScriptSafety({
    scriptName: "reset-today-history-pools",
    operation:
      arg === "--all"
        ? "delete all TodayHistoryPool rows"
        : `delete TodayHistoryPool rows where monthDay >= ${arg}`,
  });

  if (arg === "--all") {
    console.log("Deleting all TodayHistoryPool rows...");
    console.log("This operation is destructive.");

    const result = await prisma.todayHistoryPool.deleteMany({});

    console.log(`Deleted ${result.count} rows from TodayHistoryPool`);
    return;
  }

  console.log(`Deleting TodayHistoryPool rows where monthDay >= ${arg}...`);
  console.log("This operation is destructive.");

  const result = await prisma.todayHistoryPool.deleteMany({
    where: {
      monthDay: {
        gte: arg,
      },
    },
  });

  console.log(
    `Deleted ${result.count} rows from TodayHistoryPool where monthDay >= ${arg}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });