import { prisma } from "../src/app/lib/prisma";
import { requireScriptSafety } from "./lib/script-safety";

async function main() {
  requireScriptSafety({
    scriptName: "clear-highlight-cache-and-decks",
    operation: "delete all DayHighlightCache and SurpriseDeck rows",
  });

  console.log("Clearing DayHighlightCache and SurpriseDeck...");
  console.log("This operation is destructive.");

  const [cacheResult, deckResult] = await prisma.$transaction([
    prisma.dayHighlightCache.deleteMany({}),
    prisma.surpriseDeck.deleteMany({}),
  ]);

  console.log(`Deleted ${cacheResult.count} day highlight cache rows`);
  console.log(`Deleted ${deckResult.count} surprise decks`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });