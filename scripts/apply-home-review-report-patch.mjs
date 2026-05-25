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

  if (!source.includes('import { useHomeReviewReport } from "@/app/hooks/use-home-review-report";')) {
    source = source.replace(
      'import { useHomeHighlightCarousel } from "@/app/hooks/use-home-highlight-carousel";\n',
      'import { useHomeHighlightCarousel } from "@/app/hooks/use-home-highlight-carousel";\nimport { useHomeReviewReport } from "@/app/hooks/use-home-review-report";\n'
    );
  }

  const oldStateBlock = `  const [reportingReviewId, setReportingReviewId] = useState<string | null>(
    null
  );
  const [reportReviewModalOpen, setReportReviewModalOpen] = useState(false);
  const [reportReviewTargetId, setReportReviewTargetId] = useState<
    string | null
  >(null);
  const [reportReviewReason, setReportReviewReason] = useState(
    "Spam or abusive content"
  );
  const [reportReviewError, setReportReviewError] = useState("");
`;

  source = source.replace(oldStateBlock, "");

  const hookBlock = `  const {
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

  if (!source.includes("useHomeReviewReport({")) {
    const anchor = `  const { toggleFavoriteDay, refreshFavoriteDayStatus } = useHomeFavoriteDay({
    day,
    currentUser,
    hasPickedInitialDay,
    initialBundle,
    dayBundleCacheRef,
    isFavoriteDay,
    loadingFavoriteDay,
    setIsFavoriteDay,
    setLoadingFavoriteDay,
    openAuthModal,
    requireVerifiedEmail,
    showToast,
  });

`;
    if (!source.includes(anchor)) {
      throw new Error("Could not find favorite day hook anchor.");
    }

    source = source.replace(anchor, `${anchor}${hookBlock}`);
  }

  const oldFunctionBlock = `  function reportReview(ratingId: string) {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }

    if (requireVerifiedEmail()) return;

    setReportReviewTargetId(ratingId);
    setReportReviewReason("Spam or abusive content");
    setReportReviewError("");
    setReportReviewModalOpen(true);
  }

  async function submitReviewReport() {
    if (!reportReviewTargetId) return;

    const reason = reportReviewReason.trim();

    if (reason.length < 3) {
      setReportReviewError("Report reason must be at least 3 characters.");
      return;
    }

    setReportingReviewId(reportReviewTargetId);
    setReportReviewError("");
    setToast("");

    try {
      const res = await fetch("/api/review-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratingId: reportReviewTargetId,
          reason,
        }),
      });

      const json = await res.json().catch(() => null);

      if (handleProtectedActionStatus(res.status)) {
        setReportReviewModalOpen(false);
        return;
      }

      if (!res.ok) {
        setReportReviewError(json?.error ?? "Could not report review.");
        return;
      }

      setReportReviewModalOpen(false);
      setReportReviewTargetId(null);
      setReportReviewReason("Spam or abusive content");
      showToast("Review reported.");
    } catch {
      setReportReviewError("Could not report review.");
    } finally {
      setReportingReviewId(null);
    }
  }

`;

  source = source.replace(oldFunctionBlock, "");

  const oldClose = `        onClose={() => {
          if (reportingReviewId) return;
          setReportReviewModalOpen(false);
          setReportReviewTargetId(null);
          setReportReviewError("");
        }}`;
  const newClose = `        onClose={closeReviewReportModal}`;

  source = source.replace(oldClose, newClose);

  const forbidden = [
    "setReportingReviewId",
    "setReportReviewModalOpen",
    "setReportReviewTargetId",
    "setReportReviewError",
    "const [reportingReviewId",
    "const [reportReviewModalOpen",
    "const [reportReviewTargetId",
    "const [reportReviewError",
    "function reportReview(",
    "async function submitReviewReport()",
  ];

  for (const value of forbidden) {
    if (source.includes(value)) {
      throw new Error(`home-page-client.tsx still contains review report internals: ${value}`);
    }
  }

  if (!source.includes("useHomeReviewReport({")) {
    throw new Error("home-page-client.tsx does not call useHomeReviewReport.");
  }

  if (!source.includes("onClose={closeReviewReportModal}")) {
    throw new Error("ReportReasonModal was not wired to closeReviewReportModal.");
  }

  write(path, source);
  console.log("Patched src/app/home-page-client.tsx review report state.");
}

function patchRefactorContract() {
  const path = "scripts/tests/home-page-refactor-contract.test.mjs";
  let source = read(path);

  if (!source.includes('const reviewReportHook = fs.readFileSync("src/app/hooks/use-home-review-report.ts", "utf8");')) {
    source = source.replace(
      'const highlightCarouselHook = fs.readFileSync("src/app/hooks/use-home-highlight-carousel.ts", "utf8");\n',
      'const highlightCarouselHook = fs.readFileSync("src/app/hooks/use-home-highlight-carousel.ts", "utf8");\nconst reviewReportHook = fs.readFileSync("src/app/hooks/use-home-review-report.ts", "utf8");\n'
    );
  }

  const testBlock = `

test("home page delegates review report state to a dedicated hook", () => {
  assert.match(homePage, /useHomeReviewReport\\(\\{/);
  assert.match(homePage, /onClose=\\{closeReviewReportModal\\}/);
  assert.doesNotMatch(homePage, /setReportingReviewId/);
  assert.doesNotMatch(homePage, /setReportReviewModalOpen/);
  assert.doesNotMatch(homePage, /setReportReviewTargetId/);
  assert.doesNotMatch(homePage, /setReportReviewError/);
  assert.doesNotMatch(homePage, /function reportReview\\(/);
  assert.doesNotMatch(homePage, /async function submitReviewReport\\(\\)/);
  assert.match(reviewReportHook, /export function useHomeReviewReport/);
  assert.match(reviewReportHook, /const \\[reportingReviewId, setReportingReviewId\\]/);
  assert.match(reviewReportHook, /const \\[reportReviewModalOpen, setReportReviewModalOpen\\]/);
  assert.match(reviewReportHook, /const reportReview = useCallback/);
  assert.match(reviewReportHook, /const submitReviewReport = useCallback/);
  assert.match(reviewReportHook, /fetch\\("\\/api\\/review-report"/);
});
`;

  if (!source.includes("home page delegates review report state to a dedicated hook")) {
    source = `${source.trimEnd()}${testBlock}`;
  }

  write(path, source);
  console.log("Patched scripts/tests/home-page-refactor-contract.test.mjs.");
}

patchHomePage();
patchRefactorContract();

console.log("Home review report refactor patch completed.");
