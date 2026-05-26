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

  if (!source.includes('import { useHomeReplyComposer } from "@/app/hooks/use-home-reply-composer";')) {
    source = source.replace(
      'import { useHomeSuggestEvent } from "@/app/hooks/use-home-suggest-event";\n',
      'import { useHomeSuggestEvent } from "@/app/hooks/use-home-suggest-event";\nimport { useHomeReplyComposer } from "@/app/hooks/use-home-reply-composer";\n'
    );
  }

  source = source.replace("  REPLY_MAX_LENGTH,\n", "");

  const oldStateBlock = `  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyTextByRating, setReplyTextByRating] = useState<
    Record<string, string>
  >({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
`;

  if (!source.includes("useHomeReplyComposer({")) {
    if (!source.includes(oldStateBlock)) {
      throw new Error("Could not find reply composer state block.");
    }

    source = source.replace(oldStateBlock, "");
  }

  const hookBlock = `  const {
    replyingToId,
    replyTextByRating,
    sendingReplyId,
    setReplyingToId,
    setReplyTextByRating,
    submitReply,
  } = useHomeReplyComposer({
    day,
    currentUser,
    openAuthModal,
    requireVerifiedEmail,
    handleProtectedActionStatus,
    setToast,
    showToast,
    setData,
    invalidateDayCache,
  });

`;

  if (!source.includes("useHomeReplyComposer({")) {
    const anchor = `  const {
    reportingReviewId,
    reportReviewModalOpen,
    reportReviewReason,
    reportReviewError,
    setReportReviewReason,
    reportReview,
    closeReviewReportModal,
    submitReviewReport,
  } = useHomeReviewReport({
    currentUser,
    openAuthModal,
    requireVerifiedEmail,
    handleProtectedActionStatus,
    setToast,
    showToast,
  });

`;

    if (!source.includes(anchor)) {
      throw new Error("Could not find review report hook anchor.");
    }

    source = source.replace(anchor, `${anchor}${hookBlock}`);
  }

  const oldSubmitReplyBlock = `  async function submitReply(ratingId: string) {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    const text = (replyTextByRating[ratingId] ?? "").trim();

    if (!text) {
      showToast("Reply cannot be empty.");
      return;
    }

    if (text.length > REPLY_MAX_LENGTH) {
      showToast(\`Reply is too long (max \${REPLY_MAX_LENGTH} chars).\`);
      return;
    }

    setSendingReplyId(ratingId);
    setToast("");

    try {
      const res = await fetch("/api/review-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingId,
          text,
        }),
      });

      const json = await res.json().catch(() => null);

      if (handleProtectedActionStatus(res.status)) {
        return;
      }

      if (!res.ok) {
        showToast(json?.error ?? "Could not send reply.");
        return;
      }

      setReplyTextByRating((prev) => ({
        ...prev,
        [ratingId]: "",
      }));
      setReplyingToId(null);

      invalidateDayCache(day);

      if (json?.reply) {
        setData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            reviews: prev.reviews.map((item) =>
              item.id === ratingId
                ? {
                    ...item,
                    replies: [...(item.replies ?? []), json.reply],
                  }
                : item
            ),
          };
        });
      }

      showToast("Reply sent.");
    } catch {
      showToast("Could not send reply.");
    } finally {
      setSendingReplyId(null);
    }
  }

`;

  if (source.includes(oldSubmitReplyBlock)) {
    source = source.replace(oldSubmitReplyBlock, "");
  } else if (!source.includes("useHomeReplyComposer({")) {
    throw new Error("Could not find submitReply block.");
  }

  const forbidden = [
    "const [replyingToId",
    "const [replyTextByRating",
    "const [sendingReplyId",
    "setSendingReplyId",
    "async function submitReply",
    "fetch(\"/api/review-reply\"",
    "REPLY_MAX_LENGTH",
  ];

  for (const value of forbidden) {
    if (source.includes(value)) {
      throw new Error(`home-page-client.tsx still contains reply composer internals: ${value}`);
    }
  }

  if (!source.includes("useHomeReplyComposer({")) {
    throw new Error("home-page-client.tsx does not call useHomeReplyComposer.");
  }

  write(path, source);
  console.log("Patched src/app/home-page-client.tsx reply composer state.");
}

function patchRefactorContract() {
  const path = "scripts/tests/home-page-refactor-contract.test.mjs";
  let source = read(path);

  if (!source.includes('const replyComposerHook = fs.readFileSync("src/app/hooks/use-home-reply-composer.ts", "utf8");')) {
    source = source.replace(
      'const suggestEventHook = fs.readFileSync("src/app/hooks/use-home-suggest-event.ts", "utf8");\n',
      'const suggestEventHook = fs.readFileSync("src/app/hooks/use-home-suggest-event.ts", "utf8");\nconst replyComposerHook = fs.readFileSync("src/app/hooks/use-home-reply-composer.ts", "utf8");\n'
    );
  }

  const testBlock = `

test("home page delegates reply composer state to a dedicated hook", () => {
  assert.match(homePage, /useHomeReplyComposer\\(\\{/);
  assert.doesNotMatch(homePage, /const \\[replyingToId/);
  assert.doesNotMatch(homePage, /const \\[replyTextByRating/);
  assert.doesNotMatch(homePage, /const \\[sendingReplyId/);
  assert.doesNotMatch(homePage, /setSendingReplyId/);
  assert.doesNotMatch(homePage, /async function submitReply/);
  assert.doesNotMatch(homePage, /fetch\\("\\/api\\/review-reply"/);
  assert.doesNotMatch(homePage, /REPLY_MAX_LENGTH/);
  assert.match(replyComposerHook, /export function useHomeReplyComposer/);
  assert.match(replyComposerHook, /const \\[replyingToId, setReplyingToId\\]/);
  assert.match(replyComposerHook, /const \\[replyTextByRating, setReplyTextByRating\\]/);
  assert.match(replyComposerHook, /const \\[sendingReplyId, setSendingReplyId\\]/);
  assert.match(replyComposerHook, /const submitReply = useCallback/);
  assert.match(replyComposerHook, /fetch\\("\\/api\\/review-reply"/);
  assert.match(replyComposerHook, /REPLY_MAX_LENGTH/);
});
`;

  if (!source.includes("home page delegates reply composer state to a dedicated hook")) {
    source = `${source.trimEnd()}${testBlock}`;
  }

  write(path, source);
  console.log("Patched scripts/tests/home-page-refactor-contract.test.mjs.");
}

patchHomePage();
patchRefactorContract();

console.log("Home reply composer refactor patch completed.");
