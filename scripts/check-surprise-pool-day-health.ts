import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CountMap = Map<string, number>;

function increment(map: CountMap, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function top(map: CountMap, limit = 40) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

async function main() {
  const rows = await prisma.surprisePoolDay.findMany({
    where: {
      active: true,
    },
    select: {
      day: true,
      year: true,
      month: true,
      monthDay: true,
      decade: true,
      century: true,
      type: true,
      qualityScore: true,
    },
  });

  const months = new Map<string, number>();
  const monthDays = new Map<string, number>();
  const decades = new Map<string, number>();
  const centuries = new Map<string, number>();
  const types = new Map<string, number>();

  let qualityTotal = 0;

  for (const row of rows) {
    increment(months, String(row.month).padStart(2, "0"));
    increment(monthDays, row.monthDay);
    increment(decades, String(row.decade));
    increment(centuries, String(row.century));
    increment(types, row.type);

    qualityTotal += row.qualityScore;
  }

  console.log("=== SURPRISE POOL DAY HEALTH ===");
  console.log("active days:", rows.length);
  console.log(
    "avg quality:",
    rows.length > 0 ? Math.round(qualityTotal / rows.length) : 0
  );

  console.log("");
  console.log("months");
  for (const [key, value] of [...months.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    console.log(`${key}: ${value}`);
  }

  console.log("");
  console.log("top month-days");
  for (const [key, value] of top(monthDays, 40)) {
    console.log(`${key}: ${value}`);
  }

  console.log("");
  console.log("top decades");
  for (const [key, value] of top(decades, 40)) {
    console.log(`${key}: ${value}`);
  }

  console.log("");
  console.log("centuries");
  for (const [key, value] of [...centuries.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    console.log(`${key}: ${value}`);
  }

  console.log("");
  console.log("types");
  for (const [key, value] of top(types, 20)) {
    console.log(`${key}: ${value}`);
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