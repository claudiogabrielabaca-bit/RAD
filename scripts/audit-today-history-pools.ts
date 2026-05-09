import { prisma } from "../src/app/lib/prisma";

type PoolRow = {
  monthDay: string;
  validDays: unknown;
  validCount: number;
  updatedAt: Date;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getAllMonthDays() {
  const result: string[] = [];

  for (let month = 1; month <= 12; month++) {
    const daysInMonth =
      month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31;

    for (let day = 1; day <= daysInMonth; day++) {
      result.push(`${pad2(month)}-${pad2(day)}`);
    }
  }

  return result;
}

function asDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item)
      )
    )
  ).sort();
}

function getYear(day: string) {
  return Number(day.slice(0, 4));
}

function getDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

function getCentury(year: number) {
  return Math.floor(year / 100) * 100;
}

async function main() {
  const rows = (await prisma.todayHistoryPool.findMany({
    select: {
      monthDay: true,
      validDays: true,
      validCount: true,
      updatedAt: true,
    },
    orderBy: {
      monthDay: "asc",
    },
  })) as PoolRow[];

  const rowByMonthDay = new Map(rows.map((row) => [row.monthDay, row]));

  const summaries = getAllMonthDays().map((monthDay) => {
    const row = rowByMonthDay.get(monthDay);
    const days = asDays(row?.validDays);
    const years = days.map(getYear).filter(Number.isFinite);
    const decades = new Set(years.map(getDecade));
    const centuries = new Set(years.map(getCentury));

    return {
      monthDay,
      validCount: row?.validCount ?? 0,
      actualDays: days.length,
      firstDay: days[0] ?? null,
      lastDay: days[days.length - 1] ?? null,
      decades: decades.size,
      centuries: centuries.size,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  });

  const total = summaries.reduce((sum, item) => sum + item.actualDays, 0);
  const empty = summaries.filter((item) => item.actualDays === 0);
  const low30 = summaries.filter(
    (item) => item.actualDays > 0 && item.actualDays < 30
  );
  const low80 = summaries.filter(
    (item) => item.actualDays > 0 && item.actualDays < 80
  );
  const mismatch = summaries.filter(
    (item) => item.validCount !== item.actualDays
  );

  console.log("=== TODAY HISTORY POOL AUDIT ===");
  console.log("pools expected:", 366);
  console.log("pools found:", rows.length);
  console.log("total valid day refs:", total);
  console.log("empty pools:", empty.length);
  console.log("low pools < 30:", low30.length);
  console.log("low pools < 80:", low80.length);
  console.log("validCount mismatches:", mismatch.length);
  console.log("");

  console.log("lowest pools:");
  console.table(
    [...summaries]
      .sort((a, b) => a.actualDays - b.actualDays)
      .slice(0, 30)
  );

  console.log("");
  console.log("highest pools:");
  console.table(
    [...summaries]
      .sort((a, b) => b.actualDays - a.actualDays)
      .slice(0, 30)
  );

  if (mismatch.length > 0) {
    console.log("");
    console.log("validCount mismatches:");
    console.table(mismatch.slice(0, 30));
  }

  console.log("");
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
