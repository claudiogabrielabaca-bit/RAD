import { prisma } from "../src/app/lib/prisma";

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log("Usage:");
    console.log("  npx tsx .\\scripts\\reset-today-history-pools.ts --all");
    console.log("  npx tsx .\\scripts\\reset-today-history-pools.ts 03-02");
    process.exit(1);
  }

  if (arg === "--all") {
    const result = await prisma.todayHistoryPool.deleteMany({});
    console.log(`Deleted ${result.count} rows from TodayHistoryPool`);
    return;
  }

  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(arg)) {
    throw new Error("Use MM-DD format, for example: 03-02, or --all");
  }

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
