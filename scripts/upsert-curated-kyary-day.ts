import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY = "1993-01-29";
const CURATED_SOURCE = "curated_manual:kyary_pamyu_pamyu";
const WIKIPEDIA_SUMMARY_URL =
  "https://en.wikipedia.org/api/rest_v1/page/summary/Kyary_Pamyu_Pamyu";

type JsonObject = Record<string, unknown>;

type WikipediaSummary = {
  thumbnail?: {
    source?: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

type CuratedHighlight = {
  kind: string;
  type: string;
  year: number;
  title: string;
  text: string;
  image: string | null;
  articleUrl: string | null;
  category: string;
  secondaryType: string | null;
  source: string;
};

function parseYear(day: string) {
  return Number(day.slice(0, 4));
}

function parseMonth(day: string) {
  return Number(day.slice(5, 7));
}

function parseDayOfMonth(day: string) {
  return Number(day.slice(8, 10));
}

function parseMonthDay(day: string) {
  return day.slice(5, 10);
}

function getDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

function getCentury(year: number) {
  return Math.floor(year / 100) * 100;
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeHighlights(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isPlainObject);
}

function getHighlightKey(highlight: JsonObject) {
  const type = String(highlight.type ?? "");
  const year = String(highlight.year ?? "");
  const title = String(highlight.title ?? "").trim().toLowerCase();

  return `${type}:${year}:${title}`;
}

function dedupeHighlights(highlights: JsonObject[]) {
  const seen = new Set<string>();
  const result: JsonObject[] = [];

  for (const highlight of highlights) {
    const key = getHighlightKey(highlight);

    if (!key.trim() || seen.has(key)) continue;

    seen.add(key);
    result.push(highlight);
  }

  return result;
}

async function getWikipediaImage() {
  try {
    const response = await fetch(WIKIPEDIA_SUMMARY_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "RAD Curated Highlight Script/1.0 (Rate Any Day in Human History)",
      },
    });

    if (!response.ok) {
      console.warn(`Wikipedia summary failed: HTTP ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as WikipediaSummary;

    return payload.thumbnail?.source ?? null;
  } catch (error) {
    console.warn("Wikipedia summary fetch failed:", error);
    return null;
  }
}

function buildCuratedHighlight(image: string | null): CuratedHighlight {
  return {
    kind: "birth",
    type: "births",
    year: 1993,
    title: "Kyary Pamyu Pamyu",
    text: "Kyary Pamyu Pamyu, Japanese singer, model and Harajuku pop culture icon, was born in Tokyo, Japan.",
    image,
    articleUrl: "https://en.wikipedia.org/wiki/Kyary_Pamyu_Pamyu",
    category: "culture",
    secondaryType: "culture",
    source: CURATED_SOURCE,
  };
}

async function main() {
  console.log("=== UPSERT CURATED KYARY DAY ===");
  console.log("day:", DAY);

  const existingCache = await prisma.dayHighlightCache.findUnique({
    where: {
      day: DAY,
    },
  });

  const image = await getWikipediaImage();
  const curatedHighlight = buildCuratedHighlight(image);

  const existingHighlights = normalizeHighlights(existingCache?.highlights);

  const nextHighlights = dedupeHighlights([
    curatedHighlight,
    ...existingHighlights,
  ]);

  const highlightsJson = JSON.parse(JSON.stringify(nextHighlights));

  await prisma.dayHighlightCache.upsert({
    where: {
      day: DAY,
    },
    update: {
      type: curatedHighlight.type,
      year: curatedHighlight.year,
      title: curatedHighlight.title,
      text: curatedHighlight.text,
      image: curatedHighlight.image,
      articleUrl: curatedHighlight.articleUrl,
      highlights: highlightsJson,
    },
    create: {
      day: DAY,
      type: curatedHighlight.type,
      year: curatedHighlight.year,
      title: curatedHighlight.title,
      text: curatedHighlight.text,
      image: curatedHighlight.image,
      articleUrl: curatedHighlight.articleUrl,
      highlights: highlightsJson,
    },
  });

  const year = parseYear(DAY);
  const month = parseMonth(DAY);
  const dayOfMonth = parseDayOfMonth(DAY);
  const monthDay = parseMonthDay(DAY);
  const decade = getDecade(year);
  const century = getCentury(year);

  await prisma.surprisePoolDay.upsert({
    where: {
      day: DAY,
    },
    update: {
      year,
      month,
      dayOfMonth,
      monthDay,
      decade,
      century,
      type: curatedHighlight.type,
      title: curatedHighlight.title,
      text: curatedHighlight.text,
      image: curatedHighlight.image,
      articleUrl: curatedHighlight.articleUrl,
      source: CURATED_SOURCE,
      qualityScore: 1800,
      active: true,
    },
    create: {
      day: DAY,
      year,
      month,
      dayOfMonth,
      monthDay,
      decade,
      century,
      type: curatedHighlight.type,
      title: curatedHighlight.title,
      text: curatedHighlight.text,
      image: curatedHighlight.image,
      articleUrl: curatedHighlight.articleUrl,
      source: CURATED_SOURCE,
      qualityScore: 1800,
      active: true,
    },
  });

  console.log("");
  console.log("Updated DayHighlightCache primary:");
  console.log(`${DAY} -> ${curatedHighlight.title} (${curatedHighlight.type})`);

  console.log("");
  console.log("Updated SurprisePoolDay:");
  console.log(`${DAY} -> ${curatedHighlight.title} (${CURATED_SOURCE})`);

  console.log("");
  console.log("highlights count:", nextHighlights.length);
  console.log("image:", curatedHighlight.image ?? "none");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });