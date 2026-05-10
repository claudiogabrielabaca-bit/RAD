import { prisma } from "@/app/lib/prisma";
import { requireScriptSafety } from "./lib/script-safety";

async function main() {
  requireScriptSafety({
    scriptName: "delete-none-highlights",
    operation: "delete all DayHighlightCache rows where type is 'none'",
  });

  console.log("Deleting DayHighlightCache rows with type='none'...");
  console.log("This operation is destructive.");

  const result = await prisma.dayHighlightCache.deleteMany({
    where: {
      type: "none",
    },
  });

  console.log(`Deleted ${result.count} 'none' highlights`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });