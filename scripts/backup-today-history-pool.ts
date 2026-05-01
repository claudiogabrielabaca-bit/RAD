import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.todayHistoryPool.findMany({
    orderBy: {
      monthDay: "asc",
    },
  });

  const outputDir = path.join(process.cwd(), "tmp");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    `today-history-pool-backup-${Date.now()}.json`
  );

  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2), "utf8");

  console.log("Backed up TodayHistoryPool rows:", rows.length);
  console.log("Saved to:", outputPath);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });