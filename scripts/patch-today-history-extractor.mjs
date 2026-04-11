import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WIKI_PATH = path.join(ROOT, "src", "app", "lib", "wiki.ts");
const HIGHLIGHT_SERVICE_PATH = path.join(
  ROOT,
  "src",
  "app",
  "lib",
  "highlight-service.ts"
);

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function findMatchingBrace(source, openBraceIndex) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = openBraceIndex; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1] ?? "";

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingle) {
      if (!escaped && char === "\\") {
        escaped = true;
        continue;
      }
      if (!escaped && char === "'") {
        inSingle = false;
      }
      escaped = false;
      continue;
    }

    if (inDouble) {
      if (!escaped && char === "\\") {
        escaped = true;
        continue;
      }
      if (!escaped && char === '"') {
        inDouble = false;
      }
      escaped = false;
      continue;
    }

    if (inTemplate) {
      if (!escaped && char === "\\") {
        escaped = true;
        continue;
      }
      if (!escaped && char === "`") {
        inTemplate = false;
      }
      escaped = false;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      continue;
    }

    if (char === "`") {
      inTemplate = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  throw new Error("Could not find matching closing brace.");
}

function replaceFunctionBlock(source, signature, replacement) {
  const start = source.indexOf(signature);
  if (start === -1) {
    throw new Error(`Could not find function signature: ${signature}`);
  }

  const openBraceIndex = source.indexOf("{", start);
  if (openBraceIndex === -1) {
    throw new Error(`Could not find opening brace for: ${signature}`);
  }

  const closeBraceIndex = findMatchingBrace(source, openBraceIndex);

  return (
    source.slice(0, start) +
    replacement +
    source.slice(closeBraceIndex + 1)
  );
}

function replaceOnce(source, find, replace, label) {
  if (!source.includes(find)) {
    throw new Error(`Could not find block: ${label}`);
  }

  return source.replace(find, replace);
}

let wiki = readFile(WIKI_PATH);
let highlightService = readFile(HIGHLIGHT_SERVICE_PATH);

// Keep English only.
wiki = wiki.replace(
  /const WIKI_LANGS: WikiLang\[] = \[[^\]]*\];/,
  'const WIKI_LANGS: WikiLang[] = ["en"];'
);

// Insert finalizeHighlights helper if missing.
if (!wiki.includes("function finalizeHighlights(items: DayHighlight[])")) {
  wiki = replaceOnce(
    wiki,
    `function buildNoneHighlight(): DayHighlight {`,
    `function finalizeHighlights(items: DayHighlight[]) {
  let result = items.filter((item) => !isTooGenericTitle(item.title));
  result = exactUniqueHighlights(result);
  result = collapseTopicVariants(result);
  result = sortHighlights(result).slice(0, MAX_HIGHLIGHTS);
  return result;
}

function buildNoneHighlight(): DayHighlight {`,
    "insert finalizeHighlights"
  );
}

// Replace wiki getCachedHighlights.
wiki = replaceFunctionBlock(
  wiki,
  `async function getCachedHighlights(date: string): Promise<DayHighlight[] | null>`,
  `async function getCachedHighlights(date: string): Promise<DayHighlight[] | null> {
  const cached = await prisma.dayHighlightCache.findUnique({
    where: { day: date },
  });

  if (!cached) return null;

  if (
    cached.type === "none" ||
    cleanDisplayText(cached.text) === "No exact historical match was found for this date."
  ) {
    return null;
  }

  const rawItems = Array.isArray((cached as { highlights?: unknown[] }).highlights)
    ? ((cached as { highlights?: unknown[] }).highlights as Array<{
        type?: HighlightType;
        secondaryType?: HighlightType | null;
        year?: number | null;
        text?: string;
        title?: string | null;
        image?: string | null;
        articleUrl?: string | null;
      }>)
    : null;

  if (rawItems && rawItems.length > 0) {
    const mapped = rawItems
      .map((item) => ({
        type: item.type ?? "none",
        secondaryType: item.secondaryType ?? null,
        year: item.year ?? null,
        text: cleanDisplayText(item.text ?? "No description available."),
        title: cleanNullableDisplayText(item.title),
        image: item.image ?? null,
        articleUrl: item.articleUrl ?? null,
      }))
      .filter((item) => item.text && item.type !== "none");

    if (mapped.length > 0) {
      return mapped.slice(0, MAX_HIGHLIGHTS);
    }
  }

  const legacySingle: DayHighlight = {
    type: cached.type as HighlightType,
    secondaryType: null,
    year: cached.year,
    text: cleanDisplayText(cached.text),
    title: cleanNullableDisplayText(cached.title),
    image: cached.image,
    articleUrl: cached.articleUrl,
  };

  if (
    legacySingle.type === "none" ||
    legacySingle.text === "No exact historical match was found for this date."
  ) {
    return null;
  }

  return [legacySingle];
}`
);

// Replace wiki getDayHighlights.
wiki = replaceFunctionBlock(
  wiki,
  `export async function getDayHighlights(date: string): Promise<DayHighlight[]>`,
  `export async function getDayHighlights(date: string): Promise<DayHighlight[]> {
  const cached = await getCachedHighlights(date);
  if (cached) return cached;

  const [yearStr, month, day] = date.split("-");
  const selectedYear = Number(yearStr);

  let exactMatches = [];

  for (const type of PRIORITY) {
    const items = await fetchWikiType(type, month, day);

    const matchesForType = items
      .filter((item) => item.year === selectedYear)
      .sort((a, b) => scoreItem(b) - scoreItem(a))
      .map((item) => mapItem(type, item));

    exactMatches.push(...matchesForType);
  }

  let finalHighlights = finalizeHighlights(exactMatches);

  if (finalHighlights.length === 0) {
    let fallbackMatches = [];

    for (const type of PRIORITY) {
      const fallbackItems = await fetchFallbackFromDatePage(
        type,
        month,
        day,
        selectedYear
      );

      fallbackMatches.push(...fallbackItems);
    }

    finalHighlights = finalizeHighlights(fallbackMatches);
  }

  if (finalHighlights.length === 0) {
    let fallbackMatches = [];

    for (const type of PRIORITY) {
      const fallbackItems = await fetchFallbackFromDatePage(
        type,
        month,
        day,
        selectedYear
      );

      fallbackMatches.push(...fallbackItems);
    }

    finalHighlights = finalizeHighlights([
      ...exactMatches,
      ...fallbackMatches,
    ]);
  }

  if (finalHighlights.length === 0) {
    return [buildNoneHighlight()];
  }

  try {
    await saveHighlightsToCache(date, finalHighlights);
  } catch (error) {
    console.error("saveHighlightsToCache error:", error);
  }

  return finalHighlights;
}`
);

// Patch highlight-service readCachedHighlights guard.
const oldReadGuard = `  if (!row) {
    return null;
  }

  const cachedHighlights = normalizeWikiHighlights(row.highlights);`;

const newReadGuard = `  if (!row) {
    return null;
  }

  if (
    row.type === "none" ||
    row.text?.trim() === EMPTY_FALLBACK_TEXT
  ) {
    return null;
  }

  const cachedHighlights = normalizeWikiHighlights(row.highlights);`;

highlightService = replaceOnce(
  highlightService,
  oldReadGuard,
  newReadGuard,
  "readCachedHighlights guard"
);

// Patch highlight-service empty-cache write block.
const oldNoneUpsert = `    await prisma.dayHighlightCache.upsert({
      where: { day },
      update: {
        title: null,
        text: EMPTY_FALLBACK_TEXT,
        image: null,
        articleUrl: null,
        year: null,
        type: "none",
        highlights: [],
      },
      create: {
        day,
        title: null,
        text: EMPTY_FALLBACK_TEXT,
        image: null,
        articleUrl: null,
        year: null,
        type: "none",
        highlights: [],
      },
    });

    return;`;

const newNoneDelete = `    await prisma.dayHighlightCache.deleteMany({
      where: {
        day,
        type: "none",
      },
    });

    return;`;

highlightService = replaceOnce(
  highlightService,
  oldNoneUpsert,
  newNoneDelete,
  "writeHighlightsToCache none upsert"
);

writeFile(WIKI_PATH, wiki);
writeFile(HIGHLIGHT_SERVICE_PATH, highlightService);

console.log("Patched:");
console.log(" - src/app/lib/wiki.ts");
console.log(" - src/app/lib/highlight-service.ts");