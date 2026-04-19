import { prisma } from "../src/app/lib/prisma";

type DayRow = {
  day: string;
};

function monthFromDay(day: string) {
  return day.slice(5, 7);
}

function monthDayFromDay(day: string) {
  return day.slice(5, 10);
}

function yearFromDay(day: string) {
  return Number(day.slice(0, 4));
}

function decadeFromDay(day: string) {
  return Math.floor(yearFromDay(day) / 10) * 10;
}

function eraFromDay(day: string) {
  const year = yearFromDay(day);
  if (year >= 1800 && year <= 1899) return "nineteenth";
  if (year >= 2000) return "twentyFirst";
  return "twentieth";
}

function increment(map: Map<string | number, number>, key: string | number) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topN<K>(map: Map<K, number>, n = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, n);
}

function toSortedObject<K extends string | number>(map: Map<K, number>) {
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => {
      if (typeof a[0] === "number" && typeof b[0] === "number") {
        return a[0] - b[0];
      }
      return String(a[0]).localeCompare(String(b[0]));
    })
  );
}

async function main() {
  const rows: DayRow[] = await prisma.dayHighlightCache.findMany({
    where: {
      type: { not: "none" },
      title: { not: null },
      text: { not: "" },
    },
    select: {
      day: true,
    },
    orderBy: {
      day: "asc",
    },
  });

  const days = Array.from(
    new Set(
      rows
        .map((row: DayRow) => row.day)
        .filter((day): day is string => /^\d{4}-\d{2}-\d{2}$/.test(day))
    )
  );

  const monthCounts = new Map<string, number>();
  const monthDayCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();
  const decadeCounts = new Map<number, number>();
  const eraCounts = new Map<string, number>();

  for (const day of days) {
    increment(monthCounts, monthFromDay(day));
    increment(monthDayCounts, monthDayFromDay(day));
    increment(yearCounts, yearFromDay(day));
    increment(decadeCounts, decadeFromDay(day));
    increment(eraCounts, eraFromDay(day));
  }

  const result = {
    totalDays: days.length,
    monthCounts: toSortedObject(monthCounts),
    eraCounts: toSortedObject(eraCounts),
    topMonthDays: topN(monthDayCounts, 20),
    topYears: topN(yearCounts, 20),
    topDecades: topN(decadeCounts, 20),
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });