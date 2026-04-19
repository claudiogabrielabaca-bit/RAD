import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "../src/app/lib/prisma";

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike };

type CacheRow = {
  day: string;
  type: string;
  year: number | null;
  title: string | null;
  text: string;
  image: string | null;
  articleUrl: string | null;
  highlights: unknown;
};

function isValidDayString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isJsonLike(value: unknown): value is JsonLike {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonLike);
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonLike);
  }

  return false;
}

async function main() {
  const inputPath = resolve(
    process.argv[2] ?? "scripts/day-highlight-cache-export.json"
  );

  const raw = JSON.parse(readFileSync(inputPath, "utf8")) as CacheRow[];

  const rows: CacheRow[] = raw.filter(
    (row): row is CacheRow =>
      !!row &&
      typeof row.day === "string" &&
      isValidDayString(row.day) &&
      typeof row.type === "string" &&
      typeof row.text === "string"
  );

  console.log(`Importing ${rows.length} cache rows from ${inputPath}...`);

  await prisma.$transaction([
    prisma.dayHighlightCache.deleteMany({}),
    prisma.surpriseDeck.deleteMany({}),
  ]);

  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    await prisma.dayHighlightCache.createMany({
      data: batch.map((row: CacheRow) => ({
        day: row.day,
        type: row.type,
        year: row.year ?? null,
        title: row.title ?? null,
        text: row.text,
        image: row.image ?? null,
        articleUrl: row.articleUrl ?? null,
        ...(isJsonLike(row.highlights) ? { highlights: row.highlights } : {}),
      })),
    });

    console.log(
      `Imported ${Math.min(i + batch.length, rows.length)}/${rows.length}`
    );
  }

  console.log("Import finished.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });