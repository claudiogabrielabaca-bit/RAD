import fs from "node:fs";

const path = "src/app/home-page-client.tsx";
let source = fs.readFileSync(path, "utf8");

const oldBlock = `  useEffect(() => {
    refreshCurrentUser();
  }, [refreshCurrentUser]);`;

const newBlock = `  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (!cancelled) {
        void refreshCurrentUser();
      }
    };

    const browserWindow =
      typeof window !== "undefined"
        ? (window as Window & {
            requestIdleCallback?: (
              callback: () => void,
              options?: { timeout?: number }
            ) => number;
            cancelIdleCallback?: (handle: number) => void;
          })
        : null;

    if (browserWindow?.requestIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(run, {
        timeout: 1500,
      });

      return () => {
        cancelled = true;
        browserWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timeout = setTimeout(run, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [refreshCurrentUser]);`;

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) {
    throw new Error("Could not find immediate refreshCurrentUser effect.");
  }

  source = source.replace(oldBlock, newBlock);
}

fs.writeFileSync(path, source, "utf8");

console.log("Patched home-page-client.tsx to defer initial /api/me refresh.");
