import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const day = process.argv[2] ?? "1993-01-29";

async function main() {
  const cache = await prisma.dayHighlightCache.findUnique({
    where: { day },
  });

  const pool = await prisma.surprisePoolDay.findUnique({
    where: { day },
  });

  const highlights = Array.isArray(cache?.highlights)
    ? cache.highlights
    : [];

  console.log(
    JSON.stringify(
      {
        day,
        inDayHighlightCache: !!cache,
        cachePrimary: cache
          ? {
              type: cache.type,
              year: cache.year,
              title: cache.title,
              text: cache.text,
              image: cache.image,
              articleUrl: cache.articleUrl,
              highlightsCount: highlights.length,
            }
          : null,
        firstHighlights: highlights.slice(0, 10),
        inSurprisePoolDay: !!pool,
        poolRow: pool
          ? {
              active: pool.active,
              type: pool.type,
              title: pool.title,
              text: pool.text,
              source: pool.source,
              qualityScore: pool.qualityScore,
            }
          : null,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });