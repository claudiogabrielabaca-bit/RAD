"use client";

import React, { useEffect, useMemo, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string | number;
      remove?: (widgetId: string | number) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function ensureTurnstileScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    if (window.turnstile) {
      resolve();
      return;
    }

    let script = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const startedAt = Date.now();
    const maxWaitMs = 10000;

    const checkReady = () => {
      if (window.turnstile) {
        resolve();
        return;
      }

      if (Date.now() - startedAt > maxWaitMs) {
        reject(new Error("Turnstile script timed out."));
        return;
      }

      window.setTimeout(checkReady, 100);
    };

    script.addEventListener(
      "error",
      () => reject(new Error("Script load error")),
      { once: true }
    );

    script.addEventListener(
      "load",
      () => {
        checkReady();
      },
      { once: true }
    );

    checkReady();
  });
}

export default function TurnstileWidget({
  onTokenChange,
  resetKey = 0,
  theme = "dark",
}: {
  onTokenChange: (token: string) => void;
  resetKey?: number;
  theme?: "light" | "dark" | "auto";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | number | null>(null);

  const publicSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const isLocalDev = useMemo(() => {
    if (typeof window === "undefined") return false;

    return (
      process.env.NODE_ENV !== "production" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
    );
  }, []);

  useEffect(() => {
    if (isLocalDev) {
      onTokenChange("local-dev-bypass");
      return;
    }

    if (!publicSiteKey) {
      onTokenChange("");
      return;
    }

    let cancelled = false;

    async function mount() {
      try {
        await ensureTurnstileScript();

        if (cancelled || !containerRef.current || !window.turnstile) {
          return;
        }

        containerRef.current.innerHTML = "";

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: publicSiteKey,
          theme,
          callback: (token: string) => {
            onTokenChange(token);
          },
          "expired-callback": () => {
            onTokenChange("");
          },
          "timeout-callback": () => {
            onTokenChange("");
          },
          "error-callback": () => {
            onTokenChange("");
          },
        });
      } catch (error) {
        console.error("Turnstile widget mount error:", error);
        onTokenChange("");
      }
    }

    onTokenChange("");
    mount();

    return () => {
      cancelled = true;

      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [isLocalDev, onTokenChange, publicSiteKey, resetKey, theme]);

  if (isLocalDev) {
    return null;
  }

  if (!publicSiteKey) {
    return (
      <div className="text-sm text-red-300">
        Security check is unavailable. Please try again later.
      </div>
    );
  }

  return (
    <div className="w-fit">
      <div ref={containerRef} />
    </div>
  );
}