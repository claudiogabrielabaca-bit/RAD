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

  if (!source.includes('import { useHomeSuggestEvent } from "@/app/hooks/use-home-suggest-event";')) {
    source = source.replace(
      'import { useHomeReviewReport } from "@/app/hooks/use-home-review-report";\n',
      'import { useHomeReviewReport } from "@/app/hooks/use-home-review-report";\nimport { useHomeSuggestEvent } from "@/app/hooks/use-home-suggest-event";\n'
    );
  }

  source = source.replace(
    /  const \[showSuggestModal, setShowSuggestModal\] = useState\(false\);\r?\n  const \[suggestEvent, setSuggestEvent\] = useState\(""\);\r?\n  const \[suggestDescription, setSuggestDescription\] = useState\(""\);\r?\n  const \[suggestSource, setSuggestSource\] = useState\(""\);\r?\n  const \[suggestEmail, setSuggestEmail\] = useState\(""\);\r?\n  const \[suggestSending, setSuggestSending\] = useState\(false\);\r?\n  const \[suggestToast, setSuggestToast\] = useState\(""\);\r?\n\r?\n/,
    ""
  );

  const hookBlock = `  const {
    showSuggestModal,
    suggestEvent,
    suggestDescription,
    suggestSource,
    suggestEmail,
    suggestSending,
    suggestToast,
    setSuggestEvent,
    setSuggestDescription,
    setSuggestSource,
    setSuggestEmail,
    openSuggestModal,
    closeSuggestModal,
    submitSuggestion,
  } = useHomeSuggestEvent({ day });

`;

  if (!source.includes("useHomeSuggestEvent({ day })")) {
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

  source = source.replace(
    /  async function submitSuggestion\(\) \{\r?\n    if \(!suggestEvent\.trim\(\)\) \{\r?\n      setSuggestToast\("Write an event title\."\);\r?\n      return;\r?\n    \}\r?\n\r?\n    if \(!suggestDescription\.trim\(\)\) \{\r?\n      setSuggestToast\("Write a short description\."\);\r?\n      return;\r?\n    \}\r?\n\r?\n    if \(!suggestSource\.trim\(\)\) \{\r?\n      setSuggestToast\("Source is required\."\);\r?\n      return;\r?\n    \}\r?\n\r?\n    setSuggestSending\(true\);\r?\n    setSuggestToast\(""\);\r?\n\r?\n    try \{\r?\n      const res = await fetch\("\/api\/suggest-event", \{\r?\n        method: "POST",\r?\n        headers: \{\r?\n          "Content-Type": "application\/json",\r?\n        \},\r?\n        body: JSON\.stringify\(\{\r?\n          day,\r?\n          event: suggestEvent\.trim\(\),\r?\n          description: suggestDescription\.trim\(\),\r?\n          source: suggestSource\.trim\(\),\r?\n          email: suggestEmail\.trim\(\),\r?\n          website: "",\r?\n        \}\),\r?\n      \}\);\r?\n\r?\n      const json = await res\.json\(\)\.catch\(\(\) => null\);\r?\n\r?\n      if \(!res\.ok\) \{\r?\n        setSuggestToast\(json\?\.error \?\? "Could not send suggestion\."\);\r?\n        return;\r?\n      \}\r?\n\r?\n      setSuggestToast\("Suggestion sent"\);\r?\n      setSuggestEvent\(""\);\r?\n      setSuggestDescription\(""\);\r?\n      setSuggestSource\(""\);\r?\n      setSuggestEmail\(""\);\r?\n\r?\n      setTimeout\(\(\) => \{\r?\n        setShowSuggestModal\(false\);\r?\n        setSuggestToast\(""\);\r?\n      \}, 900\);\r?\n    \} catch \{\r?\n      setSuggestToast\("Could not send suggestion\."\);\r?\n    \} finally \{\r?\n      setSuggestSending\(false\);\r?\n    \}\r?\n  \}\r?\n\r?\n/,
    ""
  );

  source = source.replace(
    "                          onClick={() => setShowSuggestModal(true)}",
    "                          onClick={openSuggestModal}"
  );

  source = source.replace(
    "                onClick={() => setShowSuggestModal(false)}",
    "                onClick={closeSuggestModal}"
  );

  const forbidden = [
    "const [showSuggestModal",
    "const [suggestEvent",
    "const [suggestDescription",
    "const [suggestSource",
    "const [suggestEmail",
    "const [suggestSending",
    "const [suggestToast",
    "setSuggestSending",
    "setSuggestToast",
    "setShowSuggestModal",
    "async function submitSuggestion()",
  ];

  for (const value of forbidden) {
    if (source.includes(value)) {
      throw new Error(`home-page-client.tsx still contains suggest-event internals: ${value}`);
    }
  }

  if (!source.includes("useHomeSuggestEvent({ day })")) {
    throw new Error("home-page-client.tsx does not call useHomeSuggestEvent.");
  }

  if (!source.includes("onClick={openSuggestModal}")) {
    throw new Error("Suggest event open button was not wired to openSuggestModal.");
  }

  if (!source.includes("onClick={closeSuggestModal}")) {
    throw new Error("Suggest event close button was not wired to closeSuggestModal.");
  }

  write(path, source);
  console.log("Patched src/app/home-page-client.tsx suggest event state.");
}

function patchRefactorContract() {
  const path = "scripts/tests/home-page-refactor-contract.test.mjs";
  let source = read(path);

  if (!source.includes('const suggestEventHook = fs.readFileSync("src/app/hooks/use-home-suggest-event.ts", "utf8");')) {
    source = source.replace(
      'const reviewReportHook = fs.readFileSync("src/app/hooks/use-home-review-report.ts", "utf8");\n',
      'const reviewReportHook = fs.readFileSync("src/app/hooks/use-home-review-report.ts", "utf8");\nconst suggestEventHook = fs.readFileSync("src/app/hooks/use-home-suggest-event.ts", "utf8");\n'
    );
  }

  const testBlock = `

test("home page delegates suggest event state to a dedicated hook", () => {
  assert.match(homePage, /useHomeSuggestEvent\\(\\{ day \\}\\)/);
  assert.match(homePage, /onClick=\\{openSuggestModal\\}/);
  assert.match(homePage, /onClick=\\{closeSuggestModal\\}/);
  assert.doesNotMatch(homePage, /const \\[showSuggestModal/);
  assert.doesNotMatch(homePage, /const \\[suggestEvent/);
  assert.doesNotMatch(homePage, /const \\[suggestDescription/);
  assert.doesNotMatch(homePage, /const \\[suggestSource/);
  assert.doesNotMatch(homePage, /const \\[suggestEmail/);
  assert.doesNotMatch(homePage, /const \\[suggestSending/);
  assert.doesNotMatch(homePage, /async function submitSuggestion\\(\\)/);
  assert.match(suggestEventHook, /export function useHomeSuggestEvent/);
  assert.match(suggestEventHook, /const \\[showSuggestModal, setShowSuggestModal\\] = useState\\(false\\)/);
  assert.match(suggestEventHook, /const \\[suggestEvent, setSuggestEvent\\] = useState\\(""\\)/);
  assert.match(suggestEventHook, /const submitSuggestion = useCallback/);
  assert.match(suggestEventHook, /fetch\\("\\/api\\/suggest-event"/);
});
`;

  if (!source.includes("home page delegates suggest event state to a dedicated hook")) {
    source = `${source.trimEnd()}${testBlock}`;
  }

  write(path, source);
  console.log("Patched scripts/tests/home-page-refactor-contract.test.mjs.");
}

patchHomePage();
patchRefactorContract();

console.log("Home suggest event refactor patch completed.");
