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

  if (!source.includes('import { useHomeDeleteMutations } from "@/app/hooks/use-home-delete-mutations";')) {
    source = source.replace(
      'import { useHomeReplyComposer } from "@/app/hooks/use-home-reply-composer";\n',
      'import { useHomeReplyComposer } from "@/app/hooks/use-home-reply-composer";\nimport { useHomeDeleteMutations } from "@/app/hooks/use-home-delete-mutations";\n'
    );
  }

  source = source.replace(
    'import { removeReplyFromTree, withUpdatedReviews } from "@/app/lib/home-page-review-state";',
    'import { withUpdatedReviews } from "@/app/lib/home-page-review-state";'
  );

  const stateBlock = `  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
`;

  source = source.replace(stateBlock, "");

  const deleteActionsBlock = `  const {
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

  source = source.replace(deleteActionsBlock, "");

  const reviewDerivedBlock = `  const { myReview, otherReviews, sortedOtherReviews } =
    useHomeReviewDerivedState({
      data,
      reviewsSort,
      setStars,
      setHoverStars,
      setReview,
    });

`;

  const deleteHooksBlock = `  const { deletingReviewId, deletingReplyId, deleteReview, deleteReply } =
    useHomeDeleteMutations({
      day,
      myReviewId: myReview?.id ?? null,
      handleProtectedActionStatus,
      invalidateDayCache,
      setStars,
      setHoverStars,
      setReview,
      setToast,
      showToast,
      setData,
    });

  const {
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

  if (!source.includes("useHomeDeleteMutations({")) {
    if (!source.includes(reviewDerivedBlock)) {
      throw new Error("Could not find review derived state block.");
    }

    source = source.replace(reviewDerivedBlock, `${reviewDerivedBlock}${deleteHooksBlock}`);
  }

  const deleteReviewStart = source.indexOf("  async function deleteReview(ratingId: string)");
  if (deleteReviewStart !== -1) {
    const toggleLikeStart = source.indexOf("  async function toggleLike(ratingId: string)", deleteReviewStart);

    if (toggleLikeStart === -1) {
      throw new Error("Found deleteReview but could not find toggleLike boundary.");
    }

    source = source.slice(0, deleteReviewStart) + source.slice(toggleLikeStart);
  }

  const deleteReplyStart = source.indexOf("  async function deleteReply(replyId?: string | null)");
  if (deleteReplyStart !== -1) {
    const shareStart = source.indexOf("  async function shareCurrentDay()", deleteReplyStart);

    if (shareStart === -1) {
      throw new Error("Found deleteReply but could not find shareCurrentDay boundary.");
    }

    source = source.slice(0, deleteReplyStart) + source.slice(shareStart);
  }

  const forbidden = [
    "const [deletingReviewId",
    "const [deletingReplyId",
    "setDeletingReviewId",
    "setDeletingReplyId",
    "async function deleteReview",
    "async function deleteReply",
    "fetch(\"/api/review-delete\"",
    "fetch(\"/api/reply-delete\"",
    "removeReplyFromTree",
  ];

  for (const value of forbidden) {
    if (source.includes(value)) {
      throw new Error(`home-page-client.tsx still contains delete mutation internals: ${value}`);
    }
  }

  if (!source.includes("useHomeDeleteMutations({")) {
    throw new Error("home-page-client.tsx does not call useHomeDeleteMutations.");
  }

  if (!source.includes("useHomeDeleteActions({")) {
    throw new Error("home-page-client.tsx no longer calls useHomeDeleteActions.");
  }

  write(path, source);
  console.log("Patched src/app/home-page-client.tsx delete mutations.");
}

function patchRefactorContract() {
  const path = "scripts/tests/home-page-refactor-contract.test.mjs";
  let source = read(path);

  if (!source.includes('const deleteMutationsHook = fs.readFileSync("src/app/hooks/use-home-delete-mutations.ts", "utf8");')) {
    source = source.replace(
      'const replyComposerHook = fs.readFileSync("src/app/hooks/use-home-reply-composer.ts", "utf8");\n',
      'const replyComposerHook = fs.readFileSync("src/app/hooks/use-home-reply-composer.ts", "utf8");\nconst deleteMutationsHook = fs.readFileSync("src/app/hooks/use-home-delete-mutations.ts", "utf8");\n'
    );
  }

  const testBlock = `

test("home page delegates delete mutations to a dedicated hook", () => {
  assert.match(homePage, /useHomeDeleteMutations\\(\\{/);
  assert.match(homePage, /useHomeDeleteActions\\(\\{/);
  assert.doesNotMatch(homePage, /const \\[deletingReviewId/);
  assert.doesNotMatch(homePage, /const \\[deletingReplyId/);
  assert.doesNotMatch(homePage, /setDeletingReviewId/);
  assert.doesNotMatch(homePage, /setDeletingReplyId/);
  assert.doesNotMatch(homePage, /async function deleteReview/);
  assert.doesNotMatch(homePage, /async function deleteReply/);
  assert.doesNotMatch(homePage, /fetch\\("\\/api\\/review-delete"/);
  assert.doesNotMatch(homePage, /fetch\\("\\/api\\/reply-delete"/);
  assert.doesNotMatch(homePage, /removeReplyFromTree/);
  assert.match(deleteMutationsHook, /export function useHomeDeleteMutations/);
  assert.match(deleteMutationsHook, /const \\[deletingReviewId, setDeletingReviewId\\]/);
  assert.match(deleteMutationsHook, /const \\[deletingReplyId, setDeletingReplyId\\]/);
  assert.match(deleteMutationsHook, /const deleteReview = useCallback/);
  assert.match(deleteMutationsHook, /const deleteReply = useCallback/);
  assert.match(deleteMutationsHook, /fetch\\("\\/api\\/review-delete"/);
  assert.match(deleteMutationsHook, /fetch\\("\\/api\\/reply-delete"/);
  assert.match(deleteMutationsHook, /removeReplyFromTree/);
});
`;

  if (!source.includes("home page delegates delete mutations to a dedicated hook")) {
    source = `${source.trimEnd()}${testBlock}`;
  }

  write(path, source);
  console.log("Patched scripts/tests/home-page-refactor-contract.test.mjs.");
}

patchHomePage();
patchRefactorContract();

console.log("Home delete mutations refactor patch completed.");
