"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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
  const [devBypassEnabled, setDevBypassEnabled] = useState(false);

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
      onTokenChange(devBypassEnabled ? "local-dev-bypass" : "");
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
  }, [devBypassEnabled, isLocalDev, onTokenChange, publicSiteKey, resetKey, theme]);

  if (isLocalDev) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
        <div className="mb-2 text-xs uppercase tracking-[0.16em] text-amber-300">
          Security check
        </div>

        <div className="mb-3 text-sm text-amber-100">
          Local development bypass is active for localhost.
        </div>

        <button
          type="button"
          onClick={() => setDevBypassEnabled((prev) => !prev)}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            devBypassEnabled
              ? "bg-emerald-500 text-white"
              : "bg-white/10 text-zinc-200 hover:bg-white/15"
          }`}
        >
          {devBypassEnabled ? "Bypass enabled" : "Enable local bypass"}
        </button>
      </div>
    );
  }

  if (!publicSiteKey) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
        Security check is unavailable. Please try again later.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-xs uppercase tracking-[0.16em] text-zinc-500">
        Security check
      </div>
      <div ref={containerRef} />
    </div>
  );
}