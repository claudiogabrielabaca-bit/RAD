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
    day: "1815-06-18",
    title: "Battle of Waterloo",
    text: "Napoleon was defeated at Waterloo, ending his rule and reshaping the political order of Europe.",
    type: "war",
    secondaryType: "politics",
    image: "/featured/waterloo.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Battle_of_Waterloo",
  },
  {
    day: "1914-07-28",
    title: "World War I begins",
    text: "Austria-Hungary declared war on Serbia, triggering the conflict that became the First World War and reshaped the modern world.",
    type: "war",
    secondaryType: "politics",
    image: "/featured/ww1.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/World_War_I",
  },
  {
    day: "1939-09-01",
    title: "World War II begins",
    text: "World War II begins as Germany invades Poland.",
    type: "war",
    secondaryType: "politics",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Bundesarchiv_Bild_183-H27337%2C_Polen%2C_Infanterie_mit_Panzer_II_und_III.jpg/330px-Bundesarchiv_Bild_183-H27337%2C_Polen%2C_Infanterie_mit_Panzer_II_und_III.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Invasion_of_Poland",
  },
  {
    day: "1969-07-20",
    title: "Moon landing",
    text: "Apollo 11 lands on the Moon, and humans walk on its surface for the first time.",
    type: "science",
    secondaryType: "discovery",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Aldrin_Apollo_11.jpg/330px-Aldrin_Apollo_11.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Apollo_11",
  },
  {
    day: "1989-11-09",
    title: "Fall of the Berlin Wall",
    text: "The Berlin Wall opened, becoming the defining symbol of the collapse of the Cold War order in Europe.",
    type: "politics",
    secondaryType: "discovery",
    image: "/featured/berlin-wall.jpg",
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