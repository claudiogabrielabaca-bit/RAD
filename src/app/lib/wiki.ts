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
  if (item.pages?.[0]?.titles?.display || item.pages?.[0]?.titles?.normalized)
    score += 15;
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

  if (
    /\bborn\b|\bgives birth\b|\bis born\b|\bbirth\b/.test(content)
  ) {
    return "births";
  }

  if (
    /\bdies\b|\bdied\b|\bdeath\b|\bdeceased\b|\bpasses away\b/.test(content)
  ) {
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
  const type = detectPrimaryType(baseType, text, title);
  const secondaryType = detectSecondaryType(text, title);

  return {
    type,
    secondaryType:
      secondaryType && secondaryType !== type ? secondaryType : null,
    year,
    text,
    title,
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
        "Api-User-Agent": "RateAnyDayInHumanHistory/1.0 (local dev)",
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
    if (type === "events" || type === "selected")
      return ["Acontecimientos", "Eventos"];
    if (type === "births") return ["Nacimientos"];
    if (type === "deaths")
      return ["Fallecimientos", "Muertes", "Defunciones"];
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

function extractFirstAnchorInfo(liHtml: string, lang: WikiLang) {
  const anchorMatch = liHtml.match(
    /<a\b[^>]*href="([^"]+)"[^>]*(?:title="([^"]+)")?[^>]*>([\s\S]*?)<\/a>/i
  );

  if (!anchorMatch) {
    return { title: null as string | null, articleUrl: null as string | null };
  }

  const href = anchorMatch[1] ?? "";
  const titleAttr = anchorMatch[2] ?? "";
  const innerText = stripHtml(anchorMatch[3] ?? "") ?? null;

  return {
    title: stripHtml(titleAttr) ?? innerText,
    articleUrl: buildWikiArticleUrl(lang, href),
  };
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
    const rest = yearMatch[2]?.trim();

    if (!year || !rest) continue;
    if (year !== selectedYear) continue;

    const anchorInfo = extractFirstAnchorInfo(liHtml, lang);

    parsed.push({
      year,
      text: rest,
      title: anchorInfo.title,
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

export async function getDayHighlights(date: string): Promise<DayHighlight[]> {
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
    all = [
      {
        type: "none",
        secondaryType: null,
        year: null,
        text: "No exact historical match was found for this date.",
        title: null,
        image: null,
        articleUrl: null,
      },
    ];
  }

  const first = all[0];

  await prisma.dayHighlightCache.upsert({
    where: { day: date },
    update: {
      type: first.type,
      year: first.year,
      title: first.title,
      text: first.text,
      image: first.image,
      articleUrl: first.articleUrl,
    },
    create: {
      day: date,
      type: first.type,
      year: first.year,
      title: first.title,
      text: first.text,
      image: first.image,
      articleUrl: first.articleUrl,
    },
  });

  return all;
}

export async function getDayHighlight(date: string): Promise<DayHighlight> {
  const items = await getDayHighlights(date);
  return items[0];
}