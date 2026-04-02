import { prisma } from "../src/app/lib/prisma";

async function main() {
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
