import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const replyList = fs.readFileSync("src/app/components/rad/reply-list.tsx", "utf8");
const hook = fs.readFileSync("src/app/hooks/use-reply-report.ts", "utf8");

test("reply list delegates reply report state and actions to a dedicated hook", () => {
  assert.match(hook, /export function useReplyReport/);
  assert.match(hook, /reportReplyModalOpen/);
  assert.match(hook, /reportReplyReason/);
  assert.match(hook, /reportReplySubmitting/);
  assert.match(hook, /function reportReply/);
  assert.match(hook, /async function submitReplyReport/);
  assert.match(hook, /\/api\/reply-report/);
  assert.match(hook, /updateReplyNode/);

  assert.match(replyList, /useReplyReport\(\{/);
  assert.match(replyList, /onClose=\{closeReplyReport\}/);
  assert.doesNotMatch(replyList, /function reportReply/);
  assert.doesNotMatch(replyList, /async function submitReplyReport/);
  assert.doesNotMatch(replyList, /\/api\/reply-report/);
  assert.doesNotMatch(replyList, /setReportReplyModalOpen/);
  assert.doesNotMatch(replyList, /setReportReplyTargetId/);
});
