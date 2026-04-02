"use client";

import { useEffect, useState } from "react";
import FeedPostCard, { type FeedPostItem } from "@/app/components/rad/feed-post-card";

type FeedResponse = {
  items: FeedPostItem[];
};

export default function FeedPageClient() {
  const [items, setItems] = useState<FeedPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadFeed() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/feed", {
          cache: "no-store",
        });

        const json = (await res.json().catch(() => null)) as
          | FeedResponse
          | { error?: string }
          | null;

        if (!res.ok) {
          if (!cancelled) {
            setError(
              (json as { error?: string } | null)?.error ?? "Could not load feed."
            );
          }
          return;
        }

        if (!cancelled) {
          setItems(
            Array.isArray((json as FeedResponse | null)?.items)
              ? (json as FeedResponse).items
              : []
          );
        }
      } catch {
        if (!cancelled) {
          setError("Could not load feed.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFeed();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-transparent text-zinc-100">
      <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Feed
          </h1>
          <p className="mt-2 max-w-[560px] text-sm leading-6 text-zinc-400">
            Real written takes only. This feed ignores empty ratings and only shows
            posts that actually say something.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-[210px] animate-pulse rounded-[26px] border border-white/8 bg-white/[0.045]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[24px] border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] border border-white/8 bg-white/[0.045] px-5 py-5 text-sm text-zinc-400">
            No feed posts yet.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <FeedPostCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}