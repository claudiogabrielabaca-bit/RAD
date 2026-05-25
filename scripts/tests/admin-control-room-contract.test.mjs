import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("admin control room keeps one shared report/status contract", () => {
  const contract = read("src/app/lib/admin-control-room.ts");

  assert.match(
    contract,
    /export type AdminReportType = "review" \| "reply";/,
    "Admin report type must explicitly support review and reply reports."
  );

  assert.match(
    contract,
    /export type AdminReportStatus = "pending" \| "resolved" \| "dismissed";/,
    "Admin report statuses must use pending/resolved/dismissed as the canonical UI/API contract."
  );

  assert.match(
    contract,
    /normalized === "ignored"/,
    "Legacy ignored status must keep mapping to dismissed so older admin calls do not silently fail."
  );

  assert.match(
    contract,
    /return "dismissed";/,
    "Legacy ignored status must normalize to dismissed, not remain as a separate status."
  );
});

test("admin stats route returns nested stats and legacy flat aliases", () => {
  const statsRoute = read("src/app/api/admin/stats/route.ts");

  assert.match(
    statsRoute,
    /stats,\s*\.\.\.stats/s,
    "Stats route must return both { stats } and flat aliases to avoid breaking older/newer admin UIs."
  );

  assert.match(
    statsRoute,
    /pendingReviewReportsCount/,
    "Stats payload must include review report counters."
  );

  assert.match(
    statsRoute,
    /pendingReplyReportsCount/,
    "Stats payload must include reply report counters."
  );
});

test("admin reports route exposes a stable DTO for review and reply reports", () => {
  const reportsRoute = read("src/app/api/admin/reports/route.ts");

  assert.match(
    reportsRoute,
    /reportType:\s*"review"/,
    "Review reports must include reportType: \"review\"."
  );

  assert.match(
    reportsRoute,
    /reportType:\s*"reply"/,
    "Reply reports must include reportType: \"reply\"."
  );

  for (const field of [
    "reportedByEmail",
    "targetAuthorEmail",
    "parentReviewAuthorEmail",
    "replyText",
    "reviewText",
  ]) {
    assert.match(
      reportsRoute,
      new RegExp(`${field}:`),
      `Admin report DTO must keep the ${field} field stable.`
    );
  }
});

test("admin report resolve accepts explicit reportType and handles both report tables", () => {
  const resolveRoute = read("src/app/api/admin/report-resolve/route.ts");

  assert.match(
    resolveRoute,
    /parseAdminReportType\(body\?\.reportType\)/,
    "Report resolve must read reportType from the request body instead of guessing only by id."
  );

  assert.match(
    resolveRoute,
    /prisma\.reviewReport\.update/,
    "Report resolve must be able to update review reports."
  );

  assert.match(
    resolveRoute,
    /prisma\.replyReport\.update/,
    "Report resolve must be able to update reply reports."
  );

  assert.match(
    resolveRoute,
    /normalizeAdminReportStatus/,
    "Report resolve must normalize status values before writing them."
  );
});

test("rad control room consumes the new admin API contract", () => {
  const page = read("src/app/rad-control-room/page.tsx");

  assert.match(
    page,
    /readStatsPayload\(statsJson\)/,
    "Control room must parse the stats payload through the compatibility reader."
  );

  assert.match(
    page,
    /\["all", "pending", "resolved", "dismissed"\]/,
    "Control room filters must use dismissed, not the old ignored status."
  );

  assert.match(
    page,
    /reportType:\s*report\.reportType/,
    "Control room must send reportType when resolving a report."
  );
});
