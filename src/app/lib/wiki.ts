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

export type DayHighlight = {
  type: "selected" | "events" | "births" | "deaths" | "none";
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
const WIKI_LANGS: WikiLang[] = ["es", "en"];

function stripHtml(input: string | null | undefined) {
  if (!input) return null;
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function mapItem(type: WikiType, item: WikiItem): DayHighlight {
  const page = item.pages?.[0];

  return {
    type,
    year: item.year ?? null,
    text: item.text ?? "No description available.",
    title: stripHtml(page?.titles?.display ?? page?.titles?.normalized ?? null),
    image: page?.thumbnail?.source ?? null,
    articleUrl: page?.content_urls?.desktop?.page ?? null,
  };
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
  for (const lang of WIKI_LANGS) {
    const url = `https://api.wikimedia.org/feed/v1/wikipedia/${lang}/onthisday/${type}/${month}/${day}`;

    try {
      const data = await fetchJson(url);
      if (data?.[type]?.length) {
        return data;
      }
    } catch {
      // probar siguiente idioma
    }
  }

  return null;
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
    if (type === "births") {
      return ["Nacimientos"];
    }
    if (type === "deaths") {
      return ["Fallecimientos", "Muertes", "Defunciones"];
    }
  }

  if (lang === "en") {
    if (type === "events" || type === "selected") {
      return ["Events"];
    }
    if (type === "births") {
      return ["Births"];
    }
    if (type === "deaths") {
      return ["Deaths"];
    }
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
  const liMatches = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];
  return liMatches;
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
    return {
      title: null as string | null,
      articleUrl: null as string | null,
    };
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

    // Captura cosas tipo:
    // 1901 - ...
    // 1901 – ...
    // 1901: ...
    // 1901 — ...
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

  return parsed.sort((a, b) => scoreParsedFallbackItem(b) - scoreParsedFallbackItem(a));
}

async function fetchFallbackFromDatePage(
  type: WikiType,
  month: string,
  day: string,
  selectedYear: number
): Promise<DayHighlight | null> {
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

    if (parsedItems.length > 0) {
      const best = parsedItems[0];

      return {
        type,
        year: best.year,
        text: best.text,
        title: best.title,
        image: null,
        articleUrl: best.articleUrl,
      };
    }
  }

  return null;
}

export async function getDayHighlight(date: string): Promise<DayHighlight> {
  const cached = await prisma.dayHighlightCache.findUnique({
    where: { day: date },
  });

  if (cached) {
    return {
      type: cached.type as DayHighlight["type"],
      year: cached.year,
      text: cached.text,
      title: cached.title,
      image: cached.image,
      articleUrl: cached.articleUrl,
    };
  }

  const [yearStr, month, day] = date.split("-");
  const selectedYear = Number(yearStr);

  const settled = await Promise.allSettled(
    PRIORITY.map(async (type) => {
      const data = await fetchWikiType(type, month, day);
      const items = (data?.[type] ?? []) as WikiItem[];
      return { type, items };
    })
  );

  const allFetched: Record<WikiType, WikiItem[]> = {
    selected: [],
    events: [],
    births: [],
    deaths: [],
  };

  for (const result of settled) {
    if (result.status === "fulfilled") {
      allFetched[result.value.type] = result.value.items;
    }
  }

  let result: DayHighlight = {
    type: "none",
    year: null,
    text: "No se encontró un hecho histórico exacto para esta fecha.",
    title: null,
    image: null,
    articleUrl: null,
  };

  // 1) Intentar con OnThisDay exacto
  for (const type of PRIORITY) {
    const items = allFetched[type];
    if (!items.length) continue;

    const exactMatches = items
      .filter((item) => item.year === selectedYear)
      .sort((a, b) => scoreItem(b) - scoreItem(a));

    if (exactMatches.length > 0) {
      result = mapItem(type, exactMatches[0]);
      break;
    }
  }

  // 2) Fallback: parsear la página completa del día
  if (result.type === "none") {
    for (const type of PRIORITY) {
      const fallback = await fetchFallbackFromDatePage(
        type,
        month,
        day,
        selectedYear
      );

      if (fallback) {
        result = fallback;
        break;
      }
    }
  }

  await prisma.dayHighlightCache.upsert({
    where: { day: date },
    update: {
      type: result.type,
      year: result.year,
      title: result.title,
      text: result.text,
      image: result.image,
      articleUrl: result.articleUrl,
    },
    create: {
      day: date,
      type: result.type,
      year: result.year,
      title: result.title,
      text: result.text,
      image: result.image,
      articleUrl: result.articleUrl,
    },
  });

  return result;
}