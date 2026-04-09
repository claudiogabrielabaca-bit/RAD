import { writeFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "../src/app/lib/prisma";

async function main() {
  const outPath = resolve(
    process.argv[2] ?? "scripts/day-highlight-cache-export.json"
  );

  const rows = await prisma.dayHighlightCache.findMany({
    orderBy: { day: "asc" },
    select: {
      day: true,
      type: true,
      year: true,
      title: true,
      text: true,
      image: true,
      articleUrl: true,
      highlights: true,
    },
  });

  writeFileSync(outPath, JSON.stringify(rows), "utf8");
  console.log(`Exported ${rows.length} rows to ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
