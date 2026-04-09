import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

type CacheRow = {
  day: string;
  type: string;
  year: number | null;
  title: string | null;
  text: string;
  image: string | null;
  articleUrl: string | null;
  highlights: unknown;
};

const filePath = resolve("scripts/day-highlight-cache-export.json");

const rows = JSON.parse(readFileSync(filePath, "utf8")) as CacheRow[];

const patches: Record<string, CacheRow> = {
  "1939-09-01": {
    day: "1939-09-01",
    type: "selected",
    year: 1939,
    title: "World War II begins",
    text: "World War II begins as Germany invades Poland.",
    image: "/featured/ww2-begins.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Invasion_of_Poland",
    highlights: [
      {
        title: "World War II begins",
        text: "World War II begins as Germany invades Poland.",
        image: "/featured/ww2-begins.jpg",
        articleUrl: "https://en.wikipedia.org/wiki/Invasion_of_Poland",
        year: 1939,
        type: "selected",
        secondaryType: "war",
        kind: "event",
        category: "general",
      },
    ],
  },
  "1969-07-20": {
    day: "1969-07-20",
    type: "selected",
    year: 1969,
    title: "Moon landing",
    text: "Apollo 11 lands on the Moon, and humans walk on its surface for the first time.",
    image: "/featured/moon-landing.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Apollo_11",
    highlights: [
      {
        title: "Moon landing",
        text: "Apollo 11 lands on the Moon, and humans walk on its surface for the first time.",
        image: "/featured/moon-landing.jpg",
        articleUrl: "https://en.wikipedia.org/wiki/Apollo_11",
        year: 1969,
        type: "selected",
        secondaryType: "science",
        kind: "event",
        category: "general",
      },
    ],
  },
};

let patched = 0;

for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i];
  const replacement = patches[row.day];

  if (replacement) {
    rows[i] = replacement;
    patched += 1;
  }
}

writeFileSync(filePath, JSON.stringify(rows), "utf8");

console.log(`Patched ${patched} rows in ${filePath}`);