import { getDayHighlight, getDayHighlights, type DayHighlight } from "@/app/lib/wiki";

export type HighlightServiceResult = {
  highlight: DayHighlight;
  highlights: DayHighlight[];
};

function buildSafeFallback(): DayHighlight {
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

export async function ensureHighlightsForDay(
  day: string
): Promise<HighlightServiceResult> {
  try {
    const highlights = await getDayHighlights(day);
    const highlight = highlights[0] ?? (await getDayHighlight(day));

    if (!highlight) {
      const fallback = buildSafeFallback();
      return {
        highlight: fallback,
        highlights: [fallback],
      };
    }

    return {
      highlight,
      highlights: highlights.length ? highlights : [highlight],
    };
  } catch (error) {
    console.error("ensureHighlightsForDay error:", error);

    const fallback = buildSafeFallback();

    return {
      highlight: fallback,
      highlights: [fallback],
    };
  }
}