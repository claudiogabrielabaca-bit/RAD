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

  if (!source.includes('import { useHomeReviewLike } from "@/app/hooks/use-home-review-like";')) {
    source = source.replace(
      'import { useHomeDeleteMutations } from "@/app/hooks/use-home-delete-mutations";\n',
      'import { useHomeDeleteMutations } from "@/app/hooks/use-home-delete-mutations";\nimport { useHomeReviewLike } from "@/app/hooks/use-home-review-like";\n'
    );
  }

  const anchor = `  const {
    pendingDeleteAction,
    openDeleteReviewModal,
    openDeleteReplyModal,
    closeDeleteModal,
    handleConfirmDelete,
  } = useHomeDeleteActions({
    deletingReviewId,
    deletingReplyId,
    showToast,
    deleteReview,
    deleteReply,
  });

`;

  const hookCall = `  const { toggleLike } = useHomeReviewLike({
    data,
    currentUser,
    openAuthModal,
    requireVerifiedEmail,
    handleProtectedActionStatus,
    setData,
    showToast,
  });

`;

  if (!source.includes("useHomeReviewLike({")) {
    if (!source.includes(anchor)) {
      throw new Error("Could not find delete actions hook anchor.");
    }

    source = source.replace(anchor, `${anchor}${hookCall}`);
  }

  const toggleLikeStart = source.indexOf("  async function toggleLike(ratingId: string)");
  if (toggleLikeStart !== -1) {
    const shareStart = source.indexOf("  async function shareCurrentDay()", toggleLikeStart);

    if (shareStart === -1) {
      throw new Error("Found toggleLike but could not find shareCurrentDay boundary.");
    }

    source = source.slice(0, toggleLikeStart) + source.slice(shareStart);
  }

  const forbidden = [
    "async function toggleLike",
    "fetch(\"/api/review-like\"",
    "optimisticLiked",
    "optimisticLikesCount",
  ];

  for (const value of forbidden) {
    if (source.includes(value)) {
      throw new Error(`home-page-client.tsx still contains review-like internals: ${value}`);
    }
  }

  if (!source.includes("useHomeReviewLike({")) {
    throw new Error("home-page-client.tsx does not call useHomeReviewLike.");
  }

  if (!source.includes("onToggleLike={toggleLike}")) {
    throw new Error("HomeReactionsPanel is not wired to toggleLike.");
  }

  write(path, source);
  console.log("Patched src/app/home-page-client.tsx review-like behavior.");
}

function patchRefactorContract() {
  const path = "scripts/tests/home-page-refactor-contract.test.mjs";
  let source = read(path);

  if (!source.includes('const reviewLikeHook = fs.readFileSync("src/app/hooks/use-home-review-like.ts", "utf8");')) {
    source = source.replace(
      'const deleteMutationsHook = fs.readFileSync("src/app/hooks/use-home-delete-mutations.ts", "utf8");\n',
      'const deleteMutationsHook = fs.readFileSync("src/app/hooks/use-home-delete-mutations.ts", "utf8");\nconst reviewLikeHook = fs.readFileSync("src/app/hooks/use-home-review-like.ts", "utf8");\n'
    );
  }

  const testBlock = `

test("home page delegates review like behavior to a dedicated hook", () => {
  assert.match(homePage, /useHomeReviewLike\\(\\{/);
  assert.match(homePage, /onToggleLike=\\{toggleLike\\}/);
  assert.doesNotMatch(homePage, /async function toggleLike/);
  assert.doesNotMatch(homePage, /fetch\\("\\/api\\/review-like"/);
  assert.doesNotMatch(homePage, /optimisticLiked/);
  assert.doesNotMatch(homePage, /optimisticLikesCount/);
  assert.match(reviewLikeHook, /export function useHomeReviewLike/);
  assert.match(reviewLikeHook, /const toggleLike = useCallback/);
  assert.match(reviewLikeHook, /fetch\\("\\/api\\/review-like"/);
  assert.match(reviewLikeHook, /optimisticLiked/);
  assert.match(reviewLikeHook, /optimisticLikesCount/);
});
`;

  if (!source.includes("home page delegates review like behavior to a dedicated hook")) {
    source = `${source.trimEnd()}${testBlock}`;
  }

  write(path, source);
  console.log("Patched scripts/tests/home-page-refactor-contract.test.mjs.");
}

patchHomePage();
patchRefactorContract();

console.log("Home review-like refactor patch completed.");
