import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("admin audit log has a persistent Prisma model and migration", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260525020000_add_admin_audit_log/migration.sql");

  assert.match(schema, /model AdminAuditLog/);
  assert.match(schema, /adminUsername\s+String/);
  assert.match(schema, /action\s+String/);
  assert.match(schema, /targetType\s+String/);
  assert.match(schema, /metadata\s+Json\?/);
  assert.match(schema, /@@index\(\[adminUsername, createdAt\]/);

  assert.match(migration, /CREATE TABLE "AdminAuditLog"/);
  assert.match(migration, /CREATE INDEX "admin_audit_admin_created_at_idx"/);
  assert.match(migration, /CREATE INDEX "admin_audit_action_created_at_idx"/);
});

test("admin audit helper writes audit events without exposing secrets", () => {
  const helper = read("src/app/lib/admin-audit-log.ts");

  assert.match(helper, /prisma\.adminAuditLog\.create/);
  assert.match(helper, /admin_review_deleted/);
  assert.match(helper, /admin_review_report_status_changed/);
  assert.match(helper, /admin_reply_report_status_changed/);
  assert.doesNotMatch(helper, /password/i);
  assert.doesNotMatch(helper, /token/i);
  assert.doesNotMatch(helper, /DATABASE_URL/);
});

test("admin destructive actions write audit logs", () => {
  const deleteReview = read("src/app/api/admin/delete-review/route.ts");
  const reportResolve = read("src/app/api/admin/report-resolve/route.ts");

  assert.match(deleteReview, /logAdminAuditEvent/);
  assert.match(deleteReview, /action:\s*"admin_review_deleted"/);
  assert.match(deleteReview, /adminUsername:\s*adminSession\.username/);
  assert.match(deleteReview, /targetType:\s*"review"/);

  assert.match(reportResolve, /logAdminAuditEvent/);
  assert.match(reportResolve, /action:\s*"admin_review_report_status_changed"/);
  assert.match(reportResolve, /action:\s*"admin_reply_report_status_changed"/);
  assert.match(reportResolve, /targetType:\s*"review_report"/);
  assert.match(reportResolve, /targetType:\s*"reply_report"/);
});
