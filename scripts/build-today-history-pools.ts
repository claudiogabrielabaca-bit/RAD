import { prisma } from "../src/app/lib/prisma";

type FeedType = "selected" | "events" | "births" | "deaths";

type FeedItem = {
  year?: number;
};

type WikiSection = {
  line?: string;
  index?: string;
};

const MIN_YEAR = 1800;
const CURRENT_YEAR = new Date().getFullYear();
const FEED_TYPES: FeedType[] = ["selected", "events", "births", "deaths"];
const TARGET_SECTIONS = ["Events", "Births", "Deaths"] as const;

const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1500;
const REQUEST_GAP_MS = 500;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAllMonthDays() {
  const result: string[] = [];

  for (let month = 1; month <= 12; month++) {
    const maxDay =
      month === 2
        ? 29
        : [4, 6, 9, 11].includes(month)
          ? 30
          : 31;

    for (let day = 1; day <= maxDay; day++) {
      result.push(`${pad2(month)}-${pad2(day)}`);
    }
  }

  return result;
}

function parseMonthDayArg(value: string) {
  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    throw new Error("Use MM-DD format, for example: 04-10");
  }

  return value;
}

function getEnglishDatePageTitle(month: number, day: number) {
  const englishMonths = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return `${englishMonths[month]}_${day}`;
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/gi, "'")
    .replace(/&#0*34;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToReadableText(input: string | null | undefined) {
  if (!input) return "";

  return decodeHtmlEntities(
    input
      .replace(/<li\b[^>]*>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}

function stripReferenceMarkers(input: string) {
  return input
    .replace(/\s*\[\d+\]\s*/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeYear(year: number | null | undefined) {
  if (!year || !Number.isFinite(year)) return null;
  if (year < MIN_YEAR || year > CURRENT_YEAR) return null;
  return year;
}

function isTransientStatus(status: number) {
  return status === 429 || status >= 500;
}

async function fetchJson(url: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "RateAnyDayInHumanHistory/1.0",
          "Api-User-Agent": "RateAnyDayInHumanHistory/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        if (isTransientStatus(res.status) && attempt < MAX_RETRIES) {
          await sleep(BASE_BACKOFF_MS * attempt);
          continue;
        }

        throw new Error(`Wikipedia API error: ${res.status}`);
      }

      const data = await res.json();
      await sleep(REQUEST_GAP_MS);
      return data;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        await sleep(BASE_BACKOFF_MS * attempt);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Fetch failed");
}

async function fetchFeedYears(type: FeedType, month: number, day: number) {
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/${type}/${month}/${day}`;
  const data = await fetchJson(url);
  const items = Array.isArray(data?.[type]) ? (data[type] as FeedItem[]) : [];

  const years = new Set<number>();

  for (const item of items) {
    const year = normalizeYear(item.year);
    if (year) {
      years.add(year);
    }
  }

  return Array.from(years).sort((a, b) => a - b);
}

async function fetchDatePageSections(pageTitle: string) {
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=parse&page=${encodeURIComponent(pageTitle)}` +
    `&prop=sections&format=json&origin=*`;

  const data = await fetchJson(url);
  return Array.isArray(data?.parse?.sections)
    ? (data.parse.sections as WikiSection[])
    : [];
}

async function fetchDatePageSectionHtml(pageTitle: string, sectionIndex: string) {
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=parse&page=${encodeURIComponent(pageTitle)}` +
    `&prop=text&section=${encodeURIComponent(sectionIndex)}` +
    `&format=json&origin=*`;

  const data = await fetchJson(url);
  return typeof data?.parse?.text?.["*"] === "string"
    ? data.parse.text["*"]
    : "";
}

function parseYearsFromSectionHtml(html: string) {
  const years = new Set<number>();
  const text = htmlToReadableText(html);
  const lines = text.split("\n").map((line) => stripReferenceMarkers(line));

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d{1,4})\s*[—–\-:]\s*(.+)$/);
    if (!match) continue;

    const year = normalizeYear(Number(match[1]));
    const rest = (match[2] ?? "").trim();

    if (!year || !rest) continue;
    years.add(year);
  }

  return Array.from(years).sort((a, b) => a - b);
}

async function fetchPageYears(month: number, day: number) {
  const pageTitle = getEnglishDatePageTitle(month, day);
  const sections = await fetchDatePageSections(pageTitle);

  const yearsBySection = new Map<string, number[]>();

  for (const sectionName of TARGET_SECTIONS) {
    const section = sections.find((item) => item.line === sectionName);

    if (!section?.index) {
      yearsBySection.set(sectionName, []);
      continue;
    }

    const html = await fetchDatePageSectionHtml(pageTitle, section.index);
    const years = parseYearsFromSectionHtml(html);
    yearsBySection.set(sectionName, years);
  }

  return yearsBySection;
}

function countTotalSources(yearsBySource: Map<string, number[]>) {
  let total = 0;

  for (const years of yearsBySource.values()) {
    total += years.length;
  }

  return total;
}

async function buildPoolForMonthDay(monthDay: string) {
  const [month, day] = monthDay.split("-").map(Number);

  const yearsBySource = new Map<string, number[]>();

  try {
    for (const type of FEED_TYPES) {
      const years = await fetchFeedYears(type, month, day);
      yearsBySource.set(`feed:${type}`, years);
    }

    const pageYearsBySection = await fetchPageYears(month, day);

    for (const sectionName of TARGET_SECTIONS) {
      const years = pageYearsBySection.get(sectionName) ?? [];
      yearsBySource.set(`page:${sectionName}`, years);
    }
  } catch (error) {
    console.log(
      `[${monthDay}] SKIPPED fetch failure: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  const feedSelected = yearsBySource.get("feed:selected")?.length ?? 0;
  const feedEvents = yearsBySource.get("feed:events")?.length ?? 0;
  const feedBirths = yearsBySource.get("feed:births")?.length ?? 0;
  const feedDeaths = yearsBySource.get("feed:deaths")?.length ?? 0;
  const pageEvents = yearsBySource.get("page:Events")?.length ?? 0;
  const pageBirths = yearsBySource.get("page:Births")?.length ?? 0;
  const pageDeaths = yearsBySource.get("page:Deaths")?.length ?? 0;

  const totalSourceHits = countTotalSources(yearsBySource);

  if (totalSourceHits === 0) {
    console.log(
      `[${monthDay}] SKIPPED suspicious all-zero day | feed selected ${feedSelected} | feed events ${feedEvents} | feed births ${feedBirths} | feed deaths ${feedDeaths} | page events ${pageEvents} | page births ${pageBirths} | page deaths ${pageDeaths}`
    );
    return;
  }

  const allYears = new Set<number>();

  for (const years of yearsBySource.values()) {
    for (const year of years) {
      allYears.add(year);
    }
  }

  const validDays = Array.from(allYears)
    .sort((a, b) => a - b)
    .map((year) => `${year}-${monthDay}`);

  await prisma.todayHistoryPool.upsert({
    where: {
      monthDay,
    },
    update: {
      validDays,
      validCount: validDays.length,
    },
    create: {
      monthDay,
      validDays,
      validCount: validDays.length,
    },
  });

  console.log(
    `[${monthDay}] feed selected ${feedSelected} | feed events ${feedEvents} | feed births ${feedBirths} | feed deaths ${feedDeaths} | page events ${pageEvents} | page births ${pageBirths} | page deaths ${pageDeaths} | saved ${validDays.length} valid years`
  );
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log("Usage:");
    console.log("  npx tsx .\\scripts\\build-today-history-pools.ts 04-10");
    console.log("  npx tsx .\\scripts\\build-today-history-pools.ts --all");
    process.exit(1);
  }

  const monthDays =
    arg === "--all" ? getAllMonthDays() : [parseMonthDayArg(arg)];

  for (const monthDay of monthDays) {
    await buildPoolForMonthDay(monthDay);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });