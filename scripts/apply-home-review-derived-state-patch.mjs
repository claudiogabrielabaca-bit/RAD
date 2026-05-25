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

  if (!source.includes('import { useHomeReviewDerivedState } from "@/app/hooks/use-home-review-derived-state";')) {
    source = source.replace(
      'import { useHomeDayNavigation } from "@/app/hooks/use-home-day-navigation";\n',
      'import { useHomeDayNavigation } from "@/app/hooks/use-home-day-navigation";\nimport { useHomeReviewDerivedState } from "@/app/hooks/use-home-review-derived-state";\n'
    );
  }

  source = source.replace("  hasReviewText,\n", "");

  const oldBlock = `  const allReviews = useMemo(() => data?.reviews ?? [], [data?.reviews]);

  const myReview = useMemo(() => allReviews.find((r) => r.isMine), [allReviews]);

  useEffect(() => {
    if (!myReview) {
      setStars(0);
      setHoverStars(0);
      setReview("");
      return;
    }

    setStars(myReview.stars);
    setHoverStars(0);
    setReview(myReview.review);
  }, [myReview]);

  const otherReviews = useMemo(
    () => allReviews.filter((r) => !r.isMine),
    [allReviews]
  );

  const sortedOtherReviews = useMemo(() => {
    return [...otherReviews].sort((a, b) => {
      if (reviewsSort === "helpful") {
        if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount;

        const aHasText = hasReviewText(a.review) ? 1 : 0;
        const bHasText = hasReviewText(b.review) ? 1 : 0;
        if (bHasText !== aHasText) return bHasText - aHasText;

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [otherReviews, reviewsSort]);`;

  const newBlock = `  const { allReviews, myReview, otherReviews, sortedOtherReviews } =
    useHomeReviewDerivedState({
      data,
      reviewsSort,
      setStars,
      setHoverStars,
      setReview,
    });`;

  if (!source.includes(newBlock)) {
    if (!source.includes(oldBlock)) {
      throw new Error("Could not find review derived-state block in home-page-client.tsx.");
    }

    source = source.replace(oldBlock, newBlock);
  }

  if (!source.includes("useHomeReviewDerivedState({")) {
    throw new Error("home-page-client.tsx does not call useHomeReviewDerivedState.");
  }

  if (source.includes("const allReviews = useMemo(() => data?.reviews ?? []")) {
    throw new Error("home-page-client.tsx still owns allReviews derived state.");
  }

  if (source.includes("const sortedOtherReviews = useMemo(() => {")) {
    throw new Error("home-page-client.tsx still owns sortedOtherReviews derived state.");
  }

  if (source.includes("hasReviewText")) {
    throw new Error("home-page-client.tsx still imports or uses hasReviewText.");
  }

  write(path, source);
  console.log("Patched src/app/home-page-client.tsx review derived state.");
}

function patchRefactorContract() {
  const path = "scripts/tests/home-page-refactor-contract.test.mjs";
  let source = read(path);

  if (!source.includes('const reviewDerivedStateHook = fs.readFileSync("src/app/hooks/use-home-review-derived-state.ts", "utf8");')) {
    source = source.replace(
      'const favoriteDayHook = fs.readFileSync("src/app/hooks/use-home-favorite-day.ts", "utf8");\n',
      'const favoriteDayHook = fs.readFileSync("src/app/hooks/use-home-favorite-day.ts", "utf8");\nconst reviewDerivedStateHook = fs.readFileSync("src/app/hooks/use-home-review-derived-state.ts", "utf8");\n'
    );
  }

  const testBlock = `

test("home page delegates review derived state and sorting to a dedicated hook", () => {
  assert.match(homePage, /useHomeReviewDerivedState\\(\\{/);
  assert.match(homePage, /const \\{ allReviews, myReview, otherReviews, sortedOtherReviews \\} =/);
  assert.doesNotMatch(homePage, /const allReviews = useMemo\\(\\(\\) => data\\?\\.reviews \\?\\? \\[\\]/);
  assert.doesNotMatch(homePage, /const sortedOtherReviews = useMemo\\(\\(\\) => \\{/);
  assert.doesNotMatch(homePage, /hasReviewText/);
  assert.match(reviewDerivedStateHook, /export function useHomeReviewDerivedState/);
  assert.match(reviewDerivedStateHook, /const allReviews = useMemo/);
  assert.match(reviewDerivedStateHook, /const myReview = useMemo/);
  assert.match(reviewDerivedStateHook, /const sortedOtherReviews = useMemo/);
  assert.match(reviewDerivedStateHook, /hasReviewText/);
});
`;

  if (!source.includes('home page delegates review derived state and sorting to a dedicated hook')) {
    source = `${source.trimEnd()}${testBlock}`;
  }

  write(path, source);
  console.log("Patched scripts/tests/home-page-refactor-contract.test.mjs.");
}

patchHomePage();
patchRefactorContract();

console.log("Home review derived-state refactor patch completed.");
