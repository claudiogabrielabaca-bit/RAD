import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const replyList = fs.readFileSync("src/app/components/rad/reply-list.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-reply-like.ts", "utf8");

test("reply list delegates reply-like optimistic mutation to a dedicated hook", () => {
  assert.match(hook, /export function useReplyLike/);
  assert.match(hook, /const \[pendingLikeReplyIds, setPendingLikeReplyIds\] = useState/);
  assert.match(hook, /replyLikeRequestSeqRef/);
  assert.match(hook, /replyLikeLatestSeqByIdRef/);
  assert.match(hook, /async function toggleLike/);
  assert.match(hook, /fetch\("\/api\/reply-like"/);
  assert.match(hook, /updateReplyNode/);
  assert.match(hook, /onProtectedActionStatus\(res\.status\)/);

  assert.match(replyList, /useReplyLike\(\{/);
  assert.match(replyList, /pendingLikeReplyIds/);
  assert.match(replyList, /feedbackMessage/);
  assert.match(replyList, /toggleLike/);
  assert.doesNotMatch(replyList, /useRef/);
  assert.doesNotMatch(replyList, /setPendingLikeReplyIds/);
  assert.doesNotMatch(replyList, /replyLikeRequestSeqRef/);
  assert.doesNotMatch(replyList, /replyLikeLatestSeqByIdRef/);
  assert.doesNotMatch(replyList, /async function toggleLike/);
  assert.doesNotMatch(replyList, /fetch\("\/api\/reply-like"/);
});
