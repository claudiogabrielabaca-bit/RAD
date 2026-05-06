import { prisma } from "../src/app/lib/prisma";

async function main() {
  const monthDay = process.argv[2] ?? "05-04";

  const row = await prisma.todayHistoryPool.findUnique({
    where: { monthDay },
  });

  if (!row) {
    console.log("No TodayHistoryPool row found for", monthDay);
    return;
  }

  const validDays = Array.isArray(row.validDays) ? row.validDays : [];

  console.log("monthDay:", row.monthDay);
  console.log("validCount:", row.validCount);
  console.log("validDays.length:", validDays.length);
  console.log("createdAt:", row.createdAt);
  console.log("updatedAt:", row.updatedAt);
  console.log("");
  console.log(validDays.slice(0, 120));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
