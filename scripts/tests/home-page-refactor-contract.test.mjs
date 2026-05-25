import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const homePage = fs.readFileSync("src/app/home-page-client.tsx", "utf8");
const authHook = fs.readFileSync("src/app/hooks/use-home-auth-state.ts", "utf8");
const reviewState = fs.readFileSync("src/app/lib/home-page-review-state.ts", "utf8");
const constants = fs.readFileSync("src/app/lib/home-page-client-constants.ts", "utf8");
const dayBackHistoryHook = fs.readFileSync("src/app/hooks/use-home-day-back-history.ts", "utf8");
const dayViewTrackingHook = fs.readFileSync("src/app/hooks/use-home-day-view-tracking.ts", "utf8");
const favoriteDayHook = fs.readFileSync("src/app/hooks/use-home-favorite-day.ts", "utf8");
const reviewDerivedStateHook = fs.readFileSync("src/app/hooks/use-home-review-derived-state.ts", "utf8");
const highlightCarouselHook = fs.readFileSync("src/app/hooks/use-home-highlight-carousel.ts", "utf8");
const reviewReportHook = fs.readFileSync("src/app/hooks/use-home-review-report.ts", "utf8");

test("home page delegates auth modal/session state to a dedicated hook", () => {
  assert.match(homePage, /useHomeAuthState\(\{ router, pathname, searchParams \}\)/);
  assert.doesNotMatch(homePage, /fetchCurrentUserClientCached/);
  assert.doesNotMatch(homePage, /setCurrentUserClientCache/);
  assert.doesNotMatch(homePage, /function getAuthViewFromQuery/);
  assert.match(authHook, /function getAuthViewFromQuery/);
  assert.match(authHook, /fetchCurrentUserClientCached/);
  assert.match(authHook, /handleProtectedActionStatus/);
  assert.match(authHook, /requireVerifiedEmail/);
  assert.match(homePage, /void refreshCurrentUser\(\)/);
  assert.match(homePage, /requestIdleCallback/);
  assert.match(homePage, /setTimeout\(run,\s*1200\)/);
});

test("home page keeps review mutation helpers outside the client component", () => {
  assert.match(homePage, /from "@\/app\/lib\/home-page-review-state"/);
  assert.doesNotMatch(homePage, /function withUpdatedReviews/);
  assert.doesNotMatch(homePage, /function removeReplyFromTree/);
  assert.match(reviewState, /export function withUpdatedReviews/);
  assert.match(reviewState, /export function removeReplyFromTree/);
});

test("home page uses shared constants instead of local magic numbers", () => {
  assert.match(homePage, /from "@\/app\/lib\/home-page-client-constants"/);
  assert.doesNotMatch(homePage, /const REVIEW_MAX_LENGTH = 280/);
  assert.match(constants, /export const REVIEW_MAX_LENGTH = 280/);
  assert.match(constants, /export const HIGHLIGHT_SCROLL_OFFSET = 365/);
});


test("home page delegates day back history state to a dedicated hook", () => {
  assert.match(homePage, /useHomeDayBackHistory\(\)/);
  assert.match(homePage, /void goBackToLastViewed\(openDay\);/);
  assert.doesNotMatch(homePage, /function syncDayBackHistory/);
  assert.doesNotMatch(homePage, /function pushCurrentDayToBackHistory/);
  assert.doesNotMatch(homePage, /async function goBackToLastViewed/);
  assert.doesNotMatch(homePage, /getStoredDayBackHistory/);
  assert.doesNotMatch(homePage, /setStoredDayBackHistory/);
  assert.doesNotMatch(homePage, /DAY_BACK_HISTORY_MAX/);
  assert.match(dayBackHistoryHook, /export function useHomeDayBackHistory/);
  assert.match(dayBackHistoryHook, /getStoredDayBackHistory/);
  assert.match(dayBackHistoryHook, /setStoredDayBackHistory/);
  assert.match(dayBackHistoryHook, /DAY_BACK_HISTORY_MAX/);
});

test("home page delegates favorite day behavior to a dedicated hook", () => {
  assert.match(homePage, /useHomeFavoriteDay\(\{/);
  assert.match(homePage, /const \{ toggleFavoriteDay, refreshFavoriteDayStatus \} = useHomeFavoriteDay/);
  assert.match(homePage, /void refreshFavoriteDayStatus\(day\);/);
  assert.doesNotMatch(homePage, /FavoriteDayResponse/);
  assert.doesNotMatch(homePage, /favoriteStatusTimeoutRef/);
  assert.doesNotMatch(homePage, /loadFavoriteDayStatus/);
  assert.doesNotMatch(homePage, /async function toggleFavoriteDay/);
  assert.match(favoriteDayHook, /export function useHomeFavoriteDay/);
  assert.match(favoriteDayHook, /loadFavoriteDayStatus/);
  assert.match(favoriteDayHook, /toggleFavoriteDay/);
  assert.match(favoriteDayHook, /refreshFavoriteDayStatus/);
  assert.match(favoriteDayHook, /favoriteStatusTimeoutRef/);
  assert.match(favoriteDayHook, /\/api\/favorite-day/);
});


test("home page delegates day view tracking to a dedicated hook", () => {
  assert.match(homePage, /useHomeDayViewTracking\(\{\n    day,\n    hasPickedInitialDay,\n  \}\);/);
  assert.doesNotMatch(homePage, /dayViewTimeoutRef/);
  assert.doesNotMatch(homePage, /navigator\.sendBeacon/);
  assert.doesNotMatch(homePage, /DAY_VIEW_TRACKING_DELAY_MS/);
  assert.match(dayViewTrackingHook, /export function useHomeDayViewTracking/);
  assert.match(dayViewTrackingHook, /DAY_VIEW_TRACKING_DELAY_MS/);
  assert.match(dayViewTrackingHook, /navigator\.sendBeacon/);
  assert.match(dayViewTrackingHook, /keepalive: true/);
});

test("home page delegates review derived state and sorting to a dedicated hook", () => {
  assert.match(homePage, /useHomeReviewDerivedState\(\{/);
  assert.match(homePage, /const\s+\{\s*myReview,\s*otherReviews,\s*sortedOtherReviews\s*\}\s*=/);
  assert.doesNotMatch(homePage, /const allReviews = useMemo\(\(\) => data\?\.reviews \?\? \[\]/);
  assert.doesNotMatch(homePage, /const sortedOtherReviews = useMemo\(\(\) => \{/);
  assert.doesNotMatch(homePage, /hasReviewText/);
  assert.match(reviewDerivedStateHook, /export function useHomeReviewDerivedState/);
  assert.match(reviewDerivedStateHook, /const allReviews = useMemo/);
  assert.match(reviewDerivedStateHook, /const myReview = useMemo/);
  assert.match(reviewDerivedStateHook, /const sortedOtherReviews = useMemo/);
  assert.match(reviewDerivedStateHook, /hasReviewText/);
});

test("home page delegates highlight carousel state to a dedicated hook", () => {
  assert.match(homePage, /useHomeHighlightCarousel\(\{/);
  assert.doesNotMatch(homePage, /pendingHighlightIndexRef/);
  assert.doesNotMatch(homePage, /highlightTransitionRequestRef/);
  assert.doesNotMatch(homePage, /isHighlightPaused/);
  assert.doesNotMatch(homePage, /setIsHighlightPaused/);
  assert.doesNotMatch(homePage, /const isHighlightSwitchLocked/);
  assert.doesNotMatch(homePage, /const transitionToHighlight = useCallback/);
  assert.match(highlightCarouselHook, /export function useHomeHighlightCarousel/);
  assert.match(highlightCarouselHook, /const highlightTransitionRequestRef = useRef\(0\)/);
  assert.match(highlightCarouselHook, /const pendingHighlightIndexRef = useRef\(0\)/);
  assert.match(highlightCarouselHook, /const \[activeHighlightIndex, setActiveHighlightIndex\] = useState\(0\)/);
  assert.match(highlightCarouselHook, /const \[isHighlightPaused, setIsHighlightPaused\] = useState\(false\)/);
  assert.match(highlightCarouselHook, /const transitionToHighlight = useCallback/);
  assert.match(highlightCarouselHook, /const goToPrevHighlight = useCallback/);
  assert.match(highlightCarouselHook, /const goToNextHighlight = useCallback/);
});

test("home page delegates review report state to a dedicated hook", () => {
  assert.match(homePage, /useHomeReviewReport\(\{/);
  assert.match(homePage, /onClose=\{closeReviewReportModal\}/);
  assert.doesNotMatch(homePage, /setReportingReviewId/);
  assert.doesNotMatch(homePage, /setReportReviewModalOpen/);
  assert.doesNotMatch(homePage, /setReportReviewTargetId/);
  assert.doesNotMatch(homePage, /setReportReviewError/);
  assert.doesNotMatch(homePage, /function reportReview\(/);
  assert.doesNotMatch(homePage, /async function submitReviewReport\(\)/);
  assert.match(reviewReportHook, /export function useHomeReviewReport/);
  assert.match(reviewReportHook, /const \[reportingReviewId, setReportingReviewId\]/);
  assert.match(reviewReportHook, /const \[reportReviewModalOpen, setReportReviewModalOpen\]/);
  assert.match(reviewReportHook, /const reportReview = useCallback/);
  assert.match(reviewReportHook, /const submitReviewReport = useCallback/);
  assert.match(reviewReportHook, /fetch\("\/api\/review-report"/);
});
