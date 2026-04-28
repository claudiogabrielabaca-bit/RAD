import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CountMap = Map<string, number>;

function increment(map: CountMap, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function top(map: CountMap, limit = 30) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

async function main() {
  const rows = await prisma.dayHighlightCache.findMany({
    where: {
      type: { not: "none" },
      title: { not: null },
      text: { not: "" },
    },
    select: {
      day: true,
      type: true,
    },
  });

  const days = rows.map((row) => row.day);

  const statsRows = await prisma.dayStats.findMany({
    where: {
      day: {
        in: days,
      },
    },
    select: {
      day: true,
      views: true,
    },
  });

  const viewsByDay = new Map(statsRows.map((row) => [row.day, row.views]));

  const months = new Map<string, number>();
  const monthDays = new Map<string, number>();
  const years = new Map<string, number>();
  const decades = new Map<string, number>();
  const centuries = new Map<string, number>();
  const types = new Map<string, number>();

  let views0 = 0;
  let viewsLte1 = 0;
  let viewsLte2 = 0;
  let viewsLte5 = 0;
  let viewsGt5 = 0;

  for (const row of rows) {
    const day = row.day;
    const year = Number(day.slice(0, 4));
    const month = day.slice(5, 7);
    const monthDay = day.slice(5, 10);
    const decade = String(Math.floor(year / 10) * 10);
    const century = String(Math.floor(year / 100) * 100);
    const views = viewsByDay.get(day) ?? 0;

    increment(months, month);
    increment(monthDays, monthDay);
    increment(years, String(year));
    increment(decades, decade);
    increment(centuries, century);
    increment(types, row.type);

    if (views === 0) views0 += 1;
    if (views <= 1) viewsLte1 += 1;
    if (views <= 2) viewsLte2 += 1;
    if (views <= 5) viewsLte5 += 1;
    if (views > 5) viewsGt5 += 1;
  }

  const viewed = days
    .map((day) => ({
      day,
      views: viewsByDay.get(day) ?? 0,
    }))
    .sort((a, b) => b.views - a.views || a.day.localeCompare(b.day))
    .slice(0, 40);

  console.log("=== SURPRISE POOL HEALTH ===");
  console.log("valid surprise days:", rows.length);

  console.log("\nviews");
  console.log("views = 0:", views0);
  console.log("views <= 1:", viewsLte1);
  console.log("views <= 2:", viewsLte2);
  console.log("views <= 5:", viewsLte5);
  console.log("views > 5:", viewsGt5);

  console.log("\nmonths");
  for (const [key, value] of [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${key}: ${value}`);
  }

  console.log("\ntop month-days");
  for (const [key, value] of top(monthDays, 40)) {
    console.log(`${key}: ${value}`);
  }

  console.log("\ntop decades");
  for (const [key, value] of top(decades, 40)) {
    console.log(`${key}: ${value}`);
  }

  console.log("\ncenturies");
  for (const [key, value] of [...centuries.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${key}: ${value}`);
  }

  console.log("\ntypes");
  for (const [key, value] of top(types, 20)) {
    console.log(`${key}: ${value}`);
  }

  console.log("\ntop viewed");
  for (const item of viewed) {
    console.log(`${item.day}: ${item.views}`);
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
