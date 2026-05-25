import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, source) {
  fs.writeFileSync(path, source, "utf8");
}

function patchHomePage() {
  const path = "src/app/home-page-client.tsx";
  let source = read(path);

  if (!source.includes('import { useHomeHighlightCarousel } from "@/app/hooks/use-home-highlight-carousel";')) {
    source = source.replace(
      'import { useHomeReviewDerivedState } from "@/app/hooks/use-home-review-derived-state";\n',
      'import { useHomeReviewDerivedState } from "@/app/hooks/use-home-review-derived-state";\nimport { useHomeHighlightCarousel } from "@/app/hooks/use-home-highlight-carousel";\n'
    );
  }

  source = source.replace(
    `  const highlightTransitionRequestRef = useRef(0);
  const pendingHighlightIndexRef = useRef(0);

`,
    ""
  );

  source = source.replace(
    `  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const [isHighlightPaused, setIsHighlightPaused] = useState(false);
`,
    ""
  );

  const hookCall = `  const {
    activeHighlightIndex,
    setActiveHighlightIndex,
    canSwitchHighlights,
    transitionToHighlight,
    goToPrevHighlight,
    goToNextHighlight,
    pauseHighlightCarousel,
    resumeHighlightCarousel,
  } = useHomeHighlightCarousel({
    day,
    highlights,
    hasPickedInitialDay,
    isDayTransitioning,
    minimumTransitionDone,
    loadingDay,
    preferImmediateHighlightImageSwap,
    setHighlight,
    setPreferImmediateHighlightImageSwap,
  });

`;

  if (!source.includes("useHomeHighlightCarousel({")) {
    const anchor = `  useHomeDayViewTracking({
    day,
    hasPickedInitialDay,
  });

`;
    if (!source.includes(anchor)) {
      throw new Error("Could not find useHomeDayViewTracking anchor.");
    }

    source = source.replace(anchor, `${anchor}${hookCall}`);
  }

  const oldTransitionBlock = `  const isHighlightSwitchLocked =
    !hasPickedInitialDay ||
    isDayTransitioning ||
    !minimumTransitionDone ||
    loadingDay;

  const canSwitchHighlights =
    highlights.length > 1 && !isHighlightSwitchLocked;

  const transitionToHighlight = useCallback(
    async (nextIndex: number) => {
      if (!canSwitchHighlights) return;
      if (nextIndex < 0 || nextIndex >= highlights.length) return;

      const currentPendingIndex = pendingHighlightIndexRef.current;

      if (
        nextIndex === activeHighlightIndex &&
        nextIndex === currentPendingIndex
      ) {
        return;
      }

      pendingHighlightIndexRef.current = nextIndex;
      highlightTransitionRequestRef.current += 1;

      setPreferImmediateHighlightImageSwap(false);
      setActiveHighlightIndex(nextIndex);
    },
    [activeHighlightIndex, canSwitchHighlights, highlights.length]
  );

  useEffect(() => {
    pendingHighlightIndexRef.current = activeHighlightIndex;
  }, [activeHighlightIndex]);

  useEffect(() => {
    if (!isHighlightSwitchLocked) return;

    highlightTransitionRequestRef.current += 1;
    pendingHighlightIndexRef.current = activeHighlightIndex;
  }, [activeHighlightIndex, isHighlightSwitchLocked]);

  useEffect(() => {
    highlightTransitionRequestRef.current += 1;
    pendingHighlightIndexRef.current = activeHighlightIndex;
  }, [day, highlights, activeHighlightIndex]);

`;

  source = source.replace(oldTransitionBlock, "");

  const oldAutoBlock = `  useEffect(() => {
    if (!canSwitchHighlights || isHighlightPaused) return;

    const interval = setInterval(() => {
      const nextIndex =
        activeHighlightIndex + 1 >= highlights.length
          ? 0
          : activeHighlightIndex + 1;

      void transitionToHighlight(nextIndex);
    }, 6000);

    return () => clearInterval(interval);
  }, [
    canSwitchHighlights,
    highlights,
    isHighlightPaused,
    activeHighlightIndex,
    transitionToHighlight,
  ]);

  useEffect(() => {
    setHighlight(highlights[activeHighlightIndex] ?? null);
  }, [activeHighlightIndex, highlights]);

  useEffect(() => {
    if (!preferImmediateHighlightImageSwap) return;

    const raf = requestAnimationFrame(() => {
      setPreferImmediateHighlightImageSwap(false);
    });

    return () => cancelAnimationFrame(raf);
  }, [activeHighlightIndex, preferImmediateHighlightImageSwap]);

`;

  source = source.replace(oldAutoBlock, "");

  const oldManualHandlers = `  function goToPrevHighlight() {
    if (!canSwitchHighlights) return;

    const baseIndex = pendingHighlightIndexRef.current;
    const nextIndex = baseIndex === 0 ? highlights.length - 1 : baseIndex - 1;

    void transitionToHighlight(nextIndex);
  }

  function goToNextHighlight() {
    if (!canSwitchHighlights) return;

    const baseIndex = pendingHighlightIndexRef.current;
    const nextIndex = baseIndex === highlights.length - 1 ? 0 : baseIndex + 1;

    void transitionToHighlight(nextIndex);
  }

`;

  source = source.replace(oldManualHandlers, "");

  source = source.replace(
    "                  onMouseEnter={() => setIsHighlightPaused(true)}\n                  onMouseLeave={() => setIsHighlightPaused(false)}",
    "                  onMouseEnter={pauseHighlightCarousel}\n                  onMouseLeave={resumeHighlightCarousel}"
  );

  const forbidden = [
    "highlightTransitionRequestRef",
    "pendingHighlightIndexRef",
    "setIsHighlightPaused",
    "isHighlightPaused",
    "const isHighlightSwitchLocked",
    "const transitionToHighlight = useCallback",
    "const [activeHighlightIndex, setActiveHighlightIndex] = useState",
  ];

  for (const value of forbidden) {
    if (source.includes(value)) {
      throw new Error(`home-page-client.tsx still contains carousel internals: ${value}`);
    }
  }

  if (!source.includes("useHomeHighlightCarousel({")) {
    throw new Error("home-page-client.tsx does not call useHomeHighlightCarousel.");
  }

  write(path, source);
  console.log("Patched src/app/home-page-client.tsx highlight carousel state.");
}

function patchRefactorContract() {
  const path = "scripts/tests/home-page-refactor-contract.test.mjs";
  let source = read(path);

  if (!source.includes('const highlightCarouselHook = fs.readFileSync("src/app/hooks/use-home-highlight-carousel.ts", "utf8");')) {
    source = source.replace(
      'const reviewDerivedStateHook = fs.readFileSync("src/app/hooks/use-home-review-derived-state.ts", "utf8");\n',
      'const reviewDerivedStateHook = fs.readFileSync("src/app/hooks/use-home-review-derived-state.ts", "utf8");\nconst highlightCarouselHook = fs.readFileSync("src/app/hooks/use-home-highlight-carousel.ts", "utf8");\n'
    );
  }

  const testBlock = `

test("home page delegates highlight carousel state to a dedicated hook", () => {
  assert.match(homePage, /useHomeHighlightCarousel\\(\\{/);
  assert.doesNotMatch(homePage, /pendingHighlightIndexRef/);
  assert.doesNotMatch(homePage, /highlightTransitionRequestRef/);
  assert.doesNotMatch(homePage, /isHighlightPaused/);
  assert.doesNotMatch(homePage, /setIsHighlightPaused/);
  assert.doesNotMatch(homePage, /const isHighlightSwitchLocked/);
  assert.doesNotMatch(homePage, /const transitionToHighlight = useCallback/);
  assert.match(highlightCarouselHook, /export function useHomeHighlightCarousel/);
  assert.match(highlightCarouselHook, /const highlightTransitionRequestRef = useRef\\(0\\)/);
  assert.match(highlightCarouselHook, /const pendingHighlightIndexRef = useRef\\(0\\)/);
  assert.match(highlightCarouselHook, /const \\[activeHighlightIndex, setActiveHighlightIndex\\] = useState\\(0\\)/);
  assert.match(highlightCarouselHook, /const \\[isHighlightPaused, setIsHighlightPaused\\] = useState\\(false\\)/);
  assert.match(highlightCarouselHook, /const transitionToHighlight = useCallback/);
  assert.match(highlightCarouselHook, /const goToPrevHighlight = useCallback/);
  assert.match(highlightCarouselHook, /const goToNextHighlight = useCallback/);
});
`;

  if (!source.includes("home page delegates highlight carousel state to a dedicated hook")) {
    source = `${source.trimEnd()}${testBlock}`;
  }

  write(path, source);
  console.log("Patched scripts/tests/home-page-refactor-contract.test.mjs.");
}

patchHomePage();
patchRefactorContract();

console.log("Home highlight carousel refactor patch completed.");
