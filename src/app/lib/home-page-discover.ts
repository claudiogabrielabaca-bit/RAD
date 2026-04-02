import { pad2 } from "@/app/lib/home-page-utils";
import type { DiscoverCard } from "@/app/lib/rad-types";

export async function loadDiscoverRandomDays(
  n = 5,
  fresh = false
): Promise<DiscoverCard[]> {
  try {
    const res = await fetch(
      `/api/discover?count=${n}${fresh ? "&fresh=1" : ""}`,
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error("Failed to load discover cards");
    }

    const json = await res.json();
    return (json.cards ?? []) as DiscoverCard[];
  } catch {
    return [];
  }
}

export const YEARS = Array.from(
  { length: new Date().getFullYear() - 1800 + 1 },
  (_, i) => String(1800 + i)
).reverse();

export const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: pad2(i + 1),
  label: new Date(2000, i, 1).toLocaleString("en-US", { month: "long" }),
}));