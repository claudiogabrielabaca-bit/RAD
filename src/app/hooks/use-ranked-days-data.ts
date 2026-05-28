import { useEffect, useState } from "react";
import type { TopItem } from "@/app/lib/rad-types";

export function useRankedDaysData() {
  const [top, setTop] = useState<TopItem[]>([]);
  const [low, setLow] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/top", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load top");
        }

        const json = await res.json();

        if (cancelled) return;

        setTop((json?.top ?? []) as TopItem[]);
        setLow((json?.low ?? []) as TopItem[]);
      } catch {
        if (!cancelled) {
          setTop([]);
          setLow([]);
          setError("Could not load ranked days.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    top,
    low,
    loading,
    error,
  };
}
