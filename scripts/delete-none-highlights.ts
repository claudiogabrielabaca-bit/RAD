import { prisma } from "@/app/lib/prisma";

async function main() {
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