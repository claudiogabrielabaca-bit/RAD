import { prisma } from "../src/app/lib/prisma";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

async function main() {
  const arg = process.argv[2];

  const monthDay =
    arg && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(arg)
      ? arg
      : `${pad2(new Date().getMonth() + 1)}-${pad2(new Date().getDate())}`;

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
      image: true,
    },
    orderBy: {
      day: "asc",
    },
  });

  const usableCachedHighlights = cachedHighlights.filter((item) => {
    return (
      item.type !== "none" &&
      !!item.title?.trim() &&
      !!item.text?.trim() &&
      item.text.trim() !== "No exact historical match was found for this date."
    );
  });

  console.log({
    monthDay,
    poolValidCount: validDays.length,
    poolStoredValidCount: pool?.validCount ?? 0,
    cachedHighlights: cachedHighlights.length,
    usableCachedHighlights: usableCachedHighlights.length,
    updatedAt: pool?.updatedAt ?? null,
  });

  console.table(validDays.map((day, index) => ({ index: index + 1, day })));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
