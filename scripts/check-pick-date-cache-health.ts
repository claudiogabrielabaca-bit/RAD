import { prisma } from "@/app/lib/prisma";

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
  const rows = await prisma.pickDateCache.findMany({
    select: {
      day: true,
      status: true,
      type: true,
      source: true,
      qualityScore: true,
      title: true,
    },
    orderBy: {
      day: "asc",
    },
  });

  const statuses = new Map<string, number>();
  const years = new Map<string, number>();
  const decades = new Map<string, number>();
  const months = new Map<string, number>();
  const monthDays = new Map<string, number>();
  const types = new Map<string, number>();
  const sources = new Map<string, number>();

  let qualityTotal = 0;
  let readyCount = 0;

  for (const row of rows) {
    const year = Number(row.day.slice(0, 4));
    const month = row.day.slice(5, 7);
    const monthDay = row.day.slice(5, 10);
    const decade = String(Math.floor(year / 10) * 10);

    increment(statuses, row.status);
    increment(years, String(year));
    increment(decades, decade);
    increment(months, month);
    increment(monthDays, monthDay);
    increment(types, row.type);
    increment(sources, row.source);

    if (row.status === "ready") {
      readyCount += 1;
      qualityTotal += row.qualityScore;
    }
  }

  const avgQuality = readyCount > 0 ? Math.round(qualityTotal / readyCount) : 0;

  console.log("=== PICK DATE CACHE HEALTH ===");
  console.log("total rows:", rows.length);
  console.log("ready rows:", readyCount);
  console.log("avg ready quality:", avgQuality);

  console.log("\nstatuses");
  for (const [key, value] of [...statuses.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${key}: ${value}`);
  }

  console.log("\nmonths");
  for (const [key, value] of [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${key}: ${value}`);
  }

  console.log("\ntop years");
  for (const [key, value] of top(years, 40)) {
    console.log(`${key}: ${value}`);
  }

  console.log("\ntop decades");
  for (const [key, value] of top(decades, 40)) {
    console.log(`${key}: ${value}`);
  }

  console.log("\ntop month-days");
  for (const [key, value] of top(monthDays, 40)) {
    console.log(`${key}: ${value}`);
  }

  console.log("\ntypes");
  for (const [key, value] of top(types, 30)) {
    console.log(`${key}: ${value}`);
  }

  console.log("\nsources");
  for (const [key, value] of top(sources, 30)) {
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
