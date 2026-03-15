import type { DiscoverCard } from "@/app/lib/rad-types";
import type { DayHighlight } from "@/app/lib/wiki";

export type FeaturedMoment = {
  day: string;
  title: string;
  text: string;
  type: DiscoverCard["type"];
  secondaryType?: DayHighlight["secondaryType"];
  image: string | null;
  articleUrl: string | null;
};

export const FEATURED_MOMENTS: FeaturedMoment[] = [
  {
    day: "1914-07-28",
    title: "World War I begins",
    text: "Austria-Hungary declared war on Serbia, triggering the conflict that became the First World War and reshaped the modern world.",
    type: "war",
    secondaryType: "politics",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/World_War_I",
  },
  {
    day: "1929-10-24",
    title: "Wall Street Crash",
    text: "Black Thursday marked the beginning of the Wall Street Crash of 1929, accelerating the global economic collapse known as the Great Depression.",
    type: "disaster",
    secondaryType: "politics",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/Wall_Street_Crash_of_1929",
  },
  {
    day: "1939-09-01",
    title: "World War II begins",
    text: "Germany invaded Poland, beginning the Second World War and setting off the deadliest conflict in human history.",
    type: "war",
    secondaryType: "politics",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/Invasion_of_Poland",
  },
  {
    day: "1969-07-20",
    title: "Moon landing",
    text: "Apollo 11 landed on the Moon, and humans walked on its surface for the first time in one of the century’s defining achievements.",
    type: "science",
    secondaryType: "discovery",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/Apollo_11",
  },
  {
    day: "1989-11-09",
    title: "Fall of the Berlin Wall",
    text: "The Berlin Wall opened, becoming the defining symbol of the collapse of the Cold War order in Europe.",
    type: "politics",
    secondaryType: "discovery",
    image: null,
    articleUrl: "https://en.wikipedia.org/wiki/Fall_of_the_Berlin_Wall",
  },
];

export function getFeaturedMoment(day: string) {
  return FEATURED_MOMENTS.find((item) => item.day === day) ?? null;
}

export function getFeaturedHighlight(day: string): DayHighlight | null {
  const item = getFeaturedMoment(day);
  if (!item) return null;

  const year = Number(item.day.slice(0, 4)) || null;

  return {
    type: item.type,
    secondaryType: item.secondaryType ?? null,
    year,
    text: item.text,
    title: item.title,
    image: item.image,
    articleUrl: item.articleUrl,
  };
}