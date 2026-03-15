import { prisma } from "@/app/lib/prisma";

type WikiPage = {
  titles?: {
    display?: string;
    normalized?: string;
  };
  thumbnail?: {
    source?: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

type WikiItem = {
  text?: string;
  year?: number;
  pages?: WikiPage[];
};

export type HighlightType =
  | "selected"
  | "events"
  | "births"
  | "deaths"
  | "war"
  | "disaster"
  | "politics"
  | "science"
  | "culture"
  | "sports"
  | "discovery"
  | "crime"
  | "none";

export type DayHighlight = {
  type: HighlightType;
  secondaryType?: HighlightType | null;
  year: number | null;
  text: string;
  title: string | null;
  image: string | null;
  articleUrl: string | null;
};

type WikiType = "selected" | "events" | "births" | "deaths";
type WikiLang = "es" | "en";

type ParsedFallbackItem = {
  year: number;
  text: string;
  title: string | null;
  articleUrl: string | null;
};

type AnchorInfo = {
  title: string | null;
  articleUrl: string | null;
  rawText: string | null;
};

const PRIORITY: WikiType[] = ["selected", "events", "births", "deaths"];
const WIKI_LANGS: WikiLang[] = ["en"];
const MAX_HIGHLIGHTS = 5;

function stripHtml(input: string | null | undefined) {
  if (!input) return null;
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeText(input: string) {
  return decodeHtmlEntities(input).replace(/\s+/g, " ").trim();
}

function stripReferenceMarkers(input: string) {
  return input
    .replace(/\s*\[\d+\]\s*/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLooseText(input: string | null | undefined) {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(vietnamese|economist|historian|born|de|del|la|el|n)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractWikiSlug(url: string | null | undefined) {
  if (!url) return "";
  const match = url.match(/\/wiki\/([^?#]+)/i);
  if (!match) return "";
  return decodeURIComponent(match[1])
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildDedupKey(item: DayHighlight) {
  const slug = extractWikiSlug(item.articleUrl);
  if (slug) {
    return `slug::${item.year ?? ""}::${slug}`;
  }

  const normalizedTitle = normalizeLooseText(item.title);
  if (normalizedTitle) {
    return `title::${item.year ?? ""}::${normalizedTitle}`;
  }

  const normalizedText = normalizeLooseText(item.text).slice(0, 80);
  return `text::${item.year ?? ""}::${normalizedText}`;
}

function isEnglishHighlight(item: DayHighlight) {
  return (item.articleUrl ?? "").includes("en.wikipedia.org");
}

function preferHighlight(a: DayHighlight, b: DayHighlight) {
  const aIsEnglish = isEnglishHighlight(a);
  const bIsEnglish = isEnglishHighlight(b);

  if (aIsEnglish && !bIsEnglish) return a;
  if (bIsEnglish && !aIsEnglish) return b;

  const score = (item: DayHighlight) =>
    (item.image ? 25 : 0) +
    (item.title ? 15 : 0) +
    (item.articleUrl ? 10 : 0) +
    (item.text.length > 80 ? 5 : 0);

  return score(a) >= score(b) ? a : b;
}

function scoreItem(item: WikiItem) {
  let score = 0;
  if (item.pages?.[0]?.thumbnail?.source) score += 25;
  if (item.pages?.[0]?.titles?.display || item.pages?.[0]?.titles?.normalized) {
    score += 15;
  }
  if (item.pages?.[0]?.content_urls?.desktop?.page) score += 10;
  if (item.text && item.text.length > 80) score += 5;
  return score;
}

function scoreParsedFallbackItem(item: ParsedFallbackItem) {
  let score = 0;
  if (item.title) score += 15;
  if (item.articleUrl) score += 10;
  if (item.text.length > 80) score += 5;
  return score;
}

function detectSecondaryType(
  text: string,
  title?: string | null
): HighlightType | null {
  const content = `${title ?? ""} ${text}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    /war|battle|siege|invade|invasion|military|army|navy|troops|conflict|campaign|front|bombard|occupation|rebellion|uprising|revolt|civil war/.test(
      content
    )
  ) {
    return "war";
  }

  if (
    /earthquake|flood|hurricane|cyclone|typhoon|tsunami|eruption|volcano|wildfire|firestorm|disaster|catastrophe|avalanche|landslide|plague|pandemic|epidemic|drought|famine/.test(
      content
    )
  ) {
    return "disaster";
  }

  if (
    /president|prime minister|parliament|congress|senate|government|treaty|election|vote|cabinet|republic|monarch|king|queen|empire|constitution|independence|annexation|diplomatic|protocol|accord|judge|politician|governor|minister/.test(
      content
    )
  ) {
    return "politics";
  }

  if (
    /scientist|science|nasa|spacecraft|satellite|moon|mars|orbit|telescope|physics|chemistry|biology|experiment|laboratory|research|invention|invents|patent|technology|computer|internet|dna|medical breakthrough|astronaut|engineer/.test(
      content
    )
  ) {
    return "science";
  }

  if (
    /film|movie|cinema|album|song|music|artist|novel|book|poet|writer|theatre|theater|festival|museum|television|tv|broadcast|opera|painting|sculpture|actor|actress|director/.test(
      content
    )
  ) {
    return "culture";
  }

  if (
    /football|soccer|world cup|olympic|olympics|championship|match|tournament|grand prix|tennis|boxing|baseball|basketball|hockey|cricket|athletics|medal|player|coach/.test(
      content
    )
  ) {
    return "sports";
  }

  if (
    /discover|discovery|first|founded|founds|lands on|reaches|crosses|established|launches|opened|invented|mapped|expedition/.test(
      content
    )
  ) {
    return "discovery";
  }

  if (
    /murder|killed|assassinated|assassination|crime|robbery|massacre|kidnapping|serial killer|shooting|bombing|terrorist|terrorism|hijacking|arrested|executed/.test(
      content
    )
  ) {
    return "crime";
  }

  return null;
}

function detectPrimaryType(
  baseType: WikiType,
  text: string,
  title?: string | null
): HighlightType {
  if (baseType === "births") return "births";
  if (baseType === "deaths") return "deaths";

  const content = `${title ?? ""} ${text}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\bborn\b|\bgives birth\b|\bis born\b|\bbirth\b/.test(content)) {
    return "births";
  }

  if (/\bdies\b|\bdied\b|\bdeath\b|\bdeceased\b|\bpasses away\b/.test(content)) {
    return "deaths";
  }

  return baseType === "selected" ? "selected" : "events";
}

function buildHighlight(
  baseType: WikiType,
  text: string,
  title: string | null,
  year: number | null,
  image: string | null,
  articleUrl: string | null
): DayHighlight {
  const cleanTitle = stripReferenceMarkers(title ?? "");
  const cleanText = stripReferenceMarkers(text);
  const type = detectPrimaryType(baseType, cleanText, cleanTitle || null);
  const secondaryType = detectSecondaryType(cleanText, cleanTitle || null);

  return {
    type,
    secondaryType:
      secondaryType && secondaryType !== type ? secondaryType : null,
    year,
    text: cleanText,
    title: cleanTitle || null,
    image,
    articleUrl,
  };
}

function mapItem(type: WikiType, item: WikiItem): DayHighlight {
  const page = item.pages?.[0];
  const rawTitle = stripHtml(
    page?.titles?.display ?? page?.titles?.normalized ?? null
  );
  const rawText = item.text ?? "No description available.";

  return buildHighlight(
    type,
    rawText,
    rawTitle,
    item.year ?? null,
    page?.thumbnail?.source ?? null,
    page?.content_urls?.desktop?.page ?? null
  );
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "RateAnyDayInHumanHistory/1.0",
  "Accept": "application/json",
      },
      next: { revalidate: 86400 },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Wikipedia API error: ${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWikiType(type: WikiType, month: string, day: string) {
  const results: WikiItem[] = [];

  for (const lang of WIKI_LANGS) {
    const url = `https://api.wikimedia.org/feed/v1/wikipedia/${lang}/onthisday/${type}/${month}/${day}`;

    try {
      const data = await fetchJson(url);
      const items = (data?.[type] ?? []) as WikiItem[];
      results.push(...items);
    } catch {
      // continue
    }
  }

  return results;
}

function getDatePageTitle(lang: WikiLang, month: string, day: string) {
  const monthNum = Number(month);
  const dayNum = Number(day);

  if (lang === "es") {
    const monthNames = [
      "",
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    return `${dayNum}_de_${monthNames[monthNum]}`;
  }

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

  return `${englishMonths[monthNum]}_${dayNum}`;
}

function getSectionCandidates(type: WikiType, lang: WikiLang) {
  if (lang === "es") {
    if (type === "events" || type === "selected") {
      return ["Acontecimientos", "Eventos"];
    }
    if (type === "births") return ["Nacimientos"];
    if (type === "deaths") {
      return ["Fallecimientos", "Muertes", "Defunciones"];
    }
  }

  if (lang === "en") {
    if (type === "events" || type === "selected") return ["Events"];
    if (type === "births") return ["Births"];
    if (type === "deaths") return ["Deaths"];
  }

  return [];
}

async function fetchDatePageSections(lang: WikiLang, pageTitle: string) {
  const url =
    `https://${lang}.wikipedia.org/w/api.php` +
    `?action=parse&page=${encodeURIComponent(pageTitle)}` +
    `&prop=sections&format=json&origin=*`;

  try {
    const data = await fetchJson(url);
    return Array.isArray(data?.parse?.sections) ? data.parse.sections : [];
  } catch {
    return [];
  }
}

function isTooGenericTitle(title: string | null | undefined) {
  if (!title) return false;

  const t = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const genericPatterns = [
    "conservatism in the united states",
    "united states",
    "orem",
    "orem utah",
    "utah valley university",
    "utah",
  ];

  return genericPatterns.some((pattern) => t === pattern);
}

async function fetchDatePageSectionHtml(
  lang: WikiLang,
  pageTitle: string,
  sectionIndex: string
) {
  const url =
    `https://${lang}.wikipedia.org/w/api.php` +
    `?action=parse&page=${encodeURIComponent(pageTitle)}` +
    `&prop=text&section=${encodeURIComponent(sectionIndex)}` +
    `&format=json&origin=*`;

  try {
    const data = await fetchJson(url);
    return data?.parse?.text?.["*"] ?? "";
  } catch {
    return "";
  }
}

function extractListItemsFromHtml(html: string) {
  return html.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];
}

function buildWikiArticleUrl(lang: WikiLang, href: string) {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  return `https://${lang}.wikipedia.org${href}`;
}

function extractAnchorInfos(liHtml: string, lang: WikiLang): AnchorInfo[] {
  const matches = [
    ...liHtml.matchAll(
      /<a\b[^>]*href="([^"]+)"[^>]*(?:title="([^"]+)")?[^>]*>([\s\S]*?)<\/a>/gi
    ),
  ];

  return matches.map((match) => {
    const href = match[1] ?? "";
    const titleAttr = match[2] ?? "";
    const innerText = stripHtml(match[3] ?? "") ?? null;

    return {
      title: stripHtml(titleAttr) ?? innerText,
      rawText: innerText,
      articleUrl: buildWikiArticleUrl(lang, href),
    };
  });
}

function isNumericOrYearTitle(value: string | null | undefined) {
  if (!value) return false;
  return /^\d{1,4}$/.test(value.trim());
}

function chooseBestAnchorInfo(
  liHtml: string,
  lang: WikiLang,
  restText: string
): { title: string | null; articleUrl: string | null } {
  const anchors = extractAnchorInfos(liHtml, lang);

  if (!anchors.length) {
    return { title: null, articleUrl: null };
  }

  const leadText = stripReferenceMarkers(restText.split(",")[0] ?? "");
  const normalizedLeadText = normalizeLooseText(leadText);

  const scored = anchors.map((anchor) => {
    const candidateTitle = stripReferenceMarkers(
      anchor.title ?? anchor.rawText ?? ""
    );
    const normalizedCandidate = normalizeLooseText(candidateTitle);

    let score = 0;

    if (!isNumericOrYearTitle(candidateTitle)) score += 50;
    if (!isTooGenericTitle(candidateTitle)) score += 20;
    if (anchor.articleUrl) score += 10;

    if (
      normalizedLeadText &&
      normalizedCandidate &&
      (normalizedLeadText === normalizedCandidate ||
        normalizedLeadText.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedLeadText))
    ) {
      score += 100;
    }

    return {
      anchor: {
        title: candidateTitle || null,
        articleUrl: anchor.articleUrl,
      },
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.anchor ?? { title: null, articleUrl: null };
}

function parseFallbackItemsFromSectionHtml(
  html: string,
  selectedYear: number,
  lang: WikiLang
) {
  const listItems = extractListItemsFromHtml(html);
  const parsed: ParsedFallbackItem[] = [];

  for (const liHtml of listItems) {
    const plain = normalizeText(stripHtml(liHtml) ?? "");
    if (!plain) continue;

    const yearMatch = plain.match(/^(\d{1,4})\s*[—–\-:]\s*(.+)$/);
    if (!yearMatch) continue;

    const year = Number(yearMatch[1]);
    const rawRest = yearMatch[2]?.trim();
    const rest = stripReferenceMarkers(rawRest ?? "");

    if (!year || !rest) continue;
    if (year !== selectedYear) continue;

    const anchorInfo = chooseBestAnchorInfo(liHtml, lang, rest);
    const fallbackTitle = stripReferenceMarkers(rest.split(",")[0] ?? "");

    parsed.push({
      year,
      text: rest,
      title: anchorInfo.title ?? fallbackTitle ?? null,
      articleUrl: anchorInfo.articleUrl,
    });
  }

  return parsed.sort(
    (a, b) => scoreParsedFallbackItem(b) - scoreParsedFallbackItem(a)
  );
}

async function fetchFallbackFromDatePage(
  type: WikiType,
  month: string,
  day: string,
  selectedYear: number
): Promise<DayHighlight[]> {
  const collected: DayHighlight[] = [];

  for (const lang of WIKI_LANGS) {
    const pageTitle = getDatePageTitle(lang, month, day);
    const sections = await fetchDatePageSections(lang, pageTitle);
    if (!sections.length) continue;

    const candidateNames = getSectionCandidates(type, lang);

    const section = sections.find((sec: { line?: string; index?: string }) =>
      candidateNames.includes(sec.line ?? "")
    );

    if (!section?.index) continue;

    const html = await fetchDatePageSectionHtml(lang, pageTitle, section.index);
    if (!html) continue;

    const parsedItems = parseFallbackItemsFromSectionHtml(
      html,
      selectedYear,
      lang
    );

    for (const item of parsedItems) {
      collected.push(
        buildHighlight(
          type,
          item.text,
          item.title,
          item.year,
          null,
          item.articleUrl
        )
      );
    }
  }

  return collected;
}

function uniqueHighlights(items: DayHighlight[]) {
  const map = new Map<string, DayHighlight>();

  for (const item of items) {
    const key = buildDedupKey(item);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    map.set(key, preferHighlight(existing, item));
  }

  return Array.from(map.values());
}

function getTypeWeight(type: HighlightType) {
  switch (type) {
    case "selected":
      return 10;
    case "events":
      return 6;
    case "births":
      return 5;
    case "deaths":
      return 5;
    case "war":
      return 4;
    case "disaster":
      return 4;
    case "politics":
      return 3;
    case "science":
      return 3;
    case "discovery":
      return 3;
    case "culture":
      return 2;
    case "sports":
      return 2;
    case "crime":
      return 2;
    case "none":
    default:
      return 0;
  }
}

function getSecondaryTypeWeight(type: HighlightType | null | undefined) {
  if (!type) return 0;

  switch (type) {
    case "war":
      return 5;
    case "disaster":
      return 5;
    case "politics":
      return 4;
    case "science":
      return 4;
    case "discovery":
      return 4;
    case "culture":
      return 3;
    case "sports":
      return 3;
    case "crime":
      return 3;
    default:
      return 0;
  }
}

function sortHighlights(items: DayHighlight[]) {
  return [...items].sort((a, b) => {
    const scoreA =
      (a.image ? 25 : 0) +
      (a.title ? 15 : 0) +
      (a.articleUrl ? 10 : 0) +
      (a.text.length > 80 ? 5 : 0) +
      getTypeWeight(a.type) +
      getSecondaryTypeWeight(a.secondaryType);

    const scoreB =
      (b.image ? 25 : 0) +
      (b.title ? 15 : 0) +
      (b.articleUrl ? 10 : 0) +
      (b.text.length > 80 ? 5 : 0) +
      getTypeWeight(b.type) +
      getSecondaryTypeWeight(b.secondaryType);

    return scoreB - scoreA;
  });
}

function buildNoneHighlight(): DayHighlight {
  return {
    type: "none",
    secondaryType: null,
    year: null,
    text: "No exact historical match was found for this date.",
    title: null,
    image: null,
    articleUrl: null,
  };
}

async function getCachedHighlights(date: string): Promise<DayHighlight[] | null> {
  const cached = await prisma.dayHighlightCache.findUnique({
    where: { day: date },
  });

  if (!cached) return null;

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
        text: stripReferenceMarkers(item.text ?? "No description available."),
        title: stripReferenceMarkers(item.title ?? "") || null,
        image: item.image ?? null,
        articleUrl: item.articleUrl ?? null,
      }))
      .filter((item) => item.text);

    if (mapped.length > 0) {
      return mapped.slice(0, MAX_HIGHLIGHTS);
    }
  }

  const legacySingle: DayHighlight = {
    type: cached.type as HighlightType,
    secondaryType: null,
    year: cached.year,
    text: stripReferenceMarkers(cached.text),
    title: stripReferenceMarkers(cached.title ?? "") || null,
    image: cached.image,
    articleUrl: cached.articleUrl,
  };

  return [legacySingle];
}

async function saveHighlightsToCache(date: string, highlights: DayHighlight[]) {
  const safeHighlights = highlights
    .filter((item) => item.type !== "none")
    .slice(0, MAX_HIGHLIGHTS);

  if (safeHighlights.length === 0) return;

  await prisma.dayHighlightCache.upsert({
    where: { day: date },
    update: {
      type: safeHighlights[0].type,
      year: safeHighlights[0].year,
      title: safeHighlights[0].title,
      text: safeHighlights[0].text,
      image: safeHighlights[0].image,
      articleUrl: safeHighlights[0].articleUrl,
      highlights: safeHighlights,
    },
    create: {
      day: date,
      type: safeHighlights[0].type,
      year: safeHighlights[0].year,
      title: safeHighlights[0].title,
      text: safeHighlights[0].text,
      image: safeHighlights[0].image,
      articleUrl: safeHighlights[0].articleUrl,
      highlights: safeHighlights,
    },
  });
}

export async function getDayHighlights(date: string): Promise<DayHighlight[]> {
  const cached = await getCachedHighlights(date);
  if (cached) return cached;

  const [yearStr, month, day] = date.split("-");
  const selectedYear = Number(yearStr);

  let all: DayHighlight[] = [];

  for (const type of PRIORITY) {
    const items = await fetchWikiType(type, month, day);

    const exactMatches = items
      .filter((item) => item.year === selectedYear)
      .sort((a, b) => scoreItem(b) - scoreItem(a))
      .map((item) => mapItem(type, item));

    all.push(...exactMatches);
  }

  if (all.length === 0) {
    for (const type of PRIORITY) {
      const fallbackItems = await fetchFallbackFromDatePage(
        type,
        month,
        day,
        selectedYear
      );
      all.push(...fallbackItems);
    }
  }

  all = all.filter((item) => !isTooGenericTitle(item.title));
  all = sortHighlights(uniqueHighlights(all)).slice(0, MAX_HIGHLIGHTS);

  if (all.length === 0) {
    return [buildNoneHighlight()];
  }

 try {
  await saveHighlightsToCache(date, all);
} catch (error) {
  console.error("saveHighlightsToCache error:", error);
}

return all;
}

export async function getDayHighlight(date: string): Promise<DayHighlight> {
  const items = await getDayHighlights(date);
  return items[0] ?? buildNoneHighlight();
}