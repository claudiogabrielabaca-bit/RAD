import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const replyList = fs.readFileSync("src/app/components/rad/reply-list.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-reply-list-composer.ts", "utf8");

test("reply list delegates nested reply composer state and submit action to a dedicated hook", () => {
  assert.match(hook, /export function useReplyListComposer/);
  assert.match(hook, /replyingToReplyId/);
  assert.match(hook, /replyDraftByReplyId/);
  assert.match(hook, /sendingReplyId/);
  assert.match(hook, /function requestReply/);
  assert.match(hook, /function updateReplyDraft/);
  assert.match(hook, /function cancelReply/);
  assert.match(hook, /async function submitReplyToReply/);
  assert.match(hook, /\/api\/review-reply/);
  assert.match(hook, /insertNestedReply/);

  assert.match(replyList, /useReplyListComposer\(\{/);
  assert.match(replyList, /onRequestReply=\{requestReply\}/);
  assert.match(replyList, /onReplyDraftChange=\{updateReplyDraft\}/);
  assert.match(replyList, /onCancelReply=\{cancelReply\}/);
  assert.doesNotMatch(replyList, /setReplyingToReplyId/);
  assert.doesNotMatch(replyList, /setReplyDraftByReplyId/);
  assert.doesNotMatch(replyList, /setSendingReplyId/);
  assert.doesNotMatch(replyList, /async function submitReplyToReply/);
  assert.doesNotMatch(replyList, /\/api\/review-reply/);
  assert.doesNotMatch(replyList, /insertNestedReply/);
});
