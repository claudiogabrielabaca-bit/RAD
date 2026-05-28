import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const replyList = fs.readFileSync("src/app/components/rad/reply-list.tsx", "utf8");
const utils = fs.readFileSync("src/app/components/rad/reply-list-utils.ts", "utf8");

const helperNames = [
  "formatReviewDate",
  "isLongReply",
  "countDescendantReplies",
  "countAllReplies",
  "containsReplyId",
  "insertNestedReply",
  "updateReplyNode",
];

test("reply list keeps pure tree/date helpers outside the component file", () => {
  assert.match(replyList, /from "@\/app\/components\/rad\/reply-list-utils"/);

  for (const name of helperNames) {
    assert.match(utils, new RegExp(`export function ${name}\\(`));
    assert.doesNotMatch(replyList, new RegExp(`function ${name}\\(`));
  }

  assert.match(utils, /import \{ ReplyItem \} from "@\/app\/lib\/rad-types"/);
});
