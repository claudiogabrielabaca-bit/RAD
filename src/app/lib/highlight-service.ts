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

const FIXED_CENTURY_HIGHLIGHTS: Record<string, DayHighlight> = {
  "1914-07-28": {
    type: "war",
    secondaryType: "politics",
    year: 1914,
    title: "World War I begins",
    text: "Austria-Hungary declared war on Serbia, triggering the conflict that became the First World War and reshaped the modern world.",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/World_War_I",
  },
  "1929-10-24": {
    type: "disaster",
    secondaryType: "politics",
    year: 1929,
    title: "Wall Street Crash",
    text: "Black Thursday marked the beginning of the Wall Street Crash of 1929, accelerating the global economic collapse known as the Great Depression.",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/Wall_Street_Crash_of_1929",
  },
  "1939-09-01": {
    type: "war",
    secondaryType: "politics",
    year: 1939,
    title: "World War II begins",
    text: "Germany invaded Poland, beginning the Second World War and setting off the deadliest conflict in human history.",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/Invasion_of_Poland",
  },
  "1969-07-20": {
    type: "science",
    secondaryType: "discovery",
    year: 1969,
    title: "Moon landing",
    text: "Apollo 11 landed on the Moon, and humans walked on its surface for the first time in one of the century’s defining achievements.",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/Apollo_11",
  },
  "1989-11-09": {
    type: "politics",
    secondaryType: "discovery",
    year: 1989,
    title: "Fall of the Berlin Wall",
    text: "The Berlin Wall opened, becoming the defining symbol of the collapse of the Cold War order in Europe.",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/Fall_of_the_Berlin_Wall",
  },
};

function getFixedCenturyHighlight(day: string): DayHighlight | null {
  return FIXED_CENTURY_HIGHLIGHTS[day] ?? null;
}

export async function ensureHighlightsForDay(
  day: string
): Promise<HighlightServiceResult> {
  const fixed = getFixedCenturyHighlight(day);

  if (fixed) {
    return {
      highlight: fixed,
      highlights: [fixed],
    };
  }

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