import type { HighlightItem } from "@/app/lib/rad-types";

export type ImageLoadStatus = "loading" | "ready" | "error";

export function getHighlightPreviewLabel(item: HighlightItem, fallbackIndex: number) {
  const title = item.title?.trim();
  if (title) return title;
  if (item.year) return String(item.year);
  return `Option ${fallbackIndex + 1}`;
}

export function getSocialImageProxyUrl(image: string) {
  if (image.startsWith("/")) return image;
  if (image.startsWith("/api/social-image-proxy?")) return image;

  return `/api/social-image-proxy?url=${encodeURIComponent(image)}`;
}

export function withProxiedImage(item: HighlightItem): HighlightItem {
  if (!item.image) return item;

  return {
    ...item,
    image: getSocialImageProxyUrl(item.image),
  };
}

export function preloadImage(url: string) {
  return new Promise<ImageLoadStatus>((resolve) => {
    const img = new window.Image();

    img.onload = () => resolve("ready");
    img.onerror = () => resolve("error");
    img.src = url;
  });
}

export async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          const timeout = window.setTimeout(resolve, 4000);

          img.addEventListener(
            "load",
            () => {
              window.clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );

          img.addEventListener(
            "error",
            () => {
              window.clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );
        })
    )
  );
}
