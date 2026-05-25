import { prisma } from "@/app/lib/prisma";

export type DayRatingAggregateSummary = {
  ratingsCount: number;
  starsSum: number;
  avgStars: number;
};

type RatingAggregateSummaryRow = {
  ratingsCount: number | bigint | null;
  starsSum: number | bigint | null;
  avgStars: number | string | null;
};

function toSafeInteger(value: number | bigint | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  return 0;
}

function toSafeFloat(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function getDayRatingAggregateSummary(
  day: string
): Promise<DayRatingAggregateSummary> {
  const rows = await prisma.$queryRaw<RatingAggregateSummaryRow[]>`
    SELECT
      COUNT(*)::integer AS "ratingsCount",
      COALESCE(SUM("stars"), 0)::integer AS "starsSum",
      COALESCE(AVG("stars")::double precision, 0) AS "avgStars"
    FROM "Rating"
    WHERE "day" = ${day}
  `;

  const row = rows[0];

  return {
    ratingsCount: toSafeInteger(row?.ratingsCount),
    starsSum: toSafeInteger(row?.starsSum),
    avgStars: toSafeFloat(row?.avgStars),
  };
}

export async function refreshDayRatingAggregate(day: string) {
  const summary = await getDayRatingAggregateSummary(day);

  if (summary.ratingsCount <= 0) {
    await prisma.$executeRaw`
      DELETE FROM "DayRatingAggregate"
      WHERE "day" = ${day}
    `;
    return summary;
  }

  await prisma.$executeRaw`
    INSERT INTO "DayRatingAggregate" (
      "day",
      "ratingsCount",
      "starsSum",
      "avgStars",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${day},
      ${summary.ratingsCount},
      ${summary.starsSum},
      ${summary.avgStars},
      NOW(),
      NOW()
    )
    ON CONFLICT ("day") DO UPDATE SET
      "ratingsCount" = EXCLUDED."ratingsCount",
      "starsSum" = EXCLUDED."starsSum",
      "avgStars" = EXCLUDED."avgStars",
      "updatedAt" = NOW()
  `;

  return summary;
}
