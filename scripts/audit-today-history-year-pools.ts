import { prisma } from "../src/app/lib/prisma";

const EMPTY_FALLBACK_TEXT = "No exact historical match was found for this date.";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getAllMonthDays() {
  const monthDays: string[] = [];

  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(2024, month - 1, day);

      if (date.getMonth() !== month - 1) continue;

      monthDays.push(`${pad2(month)}-${pad2(day)}`);
    }
  }

  return monthDays;
}

function isUsableHighlight(item: {
  title: string | null;
  text: string | null;
  type: string | null;
}) {
  return (
    item.type !== "none" &&
    !!item.title?.trim() &&
    !!item.text?.trim() &&
    item.text.trim() !== EMPTY_FALLBACK_TEXT
  );
}

async function main() {
  const monthDays = getAllMonthDays();
  const rows = [];

  for (const monthDay of monthDays) {
    const pool = await prisma.todayHistoryPool.findUnique({
      where: { monthDay },
      select: {
        monthDay: true,
        validCount: true,
        validDays: true,
        updatedAt: true,
      },
    });

    const validDays = Array.isArray(pool?.validDays)
      ? pool.validDays.filter((item): item is string => typeof item === "string")
      : [];

    const cachedHighlights = await prisma.dayHighlightCache.findMany({
      where: {
        day: {
          endsWith: `-${monthDay}`,
        },
      },
      select: {
        day: true,
        title: true,
        text: true,
        type: true,
      },
    });

    const usableCachedHighlights = cachedHighlights.filter(isUsableHighlight);

    const storedValidCount = pool?.validCount ?? 0;

    rows.push({
      monthDay,
      poolValidCount: validDays.length,
      storedValidCount,
      usableCachedHighlights: usableCachedHighlights.length,
      cachedHighlights: cachedHighlights.length,
      status:
        validDays.length > 0 &&
        validDays.length === storedValidCount &&
        validDays.length === usableCachedHighlights.length
          ? "ok"
          : "check",
      updatedAt: pool?.updatedAt?.toISOString() ?? null,
    });
  }

  const badRows = rows.filter((row) => row.status !== "ok");

  console.table(rows);
  console.log("");
  console.log(`Total month-days: ${rows.length}`);
  console.log(`OK: ${rows.length - badRows.length}`);
  console.log(`Needs check: ${badRows.length}`);

  if (badRows.length > 0) {
    console.log("");
    console.log("Problematic month-days:");
    console.table(badRows);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
