import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("runbook de producción documenta operación segura", () => {
  const runbook = read("docs/production-runbook.md");

  assert.match(runbook, /npm run check/);
  assert.match(runbook, /npx prisma migrate status/);
  assert.match(runbook, /npx prisma migrate deploy/);
  assert.match(runbook, /migrate dev/);
  assert.match(runbook, /\/api\/health/);
  assert.match(runbook, /npm run repo:audit/);
  assert.match(runbook, /db-backup\.ps1/);
});

test("checklist de restore documenta verificación y restauración", () => {
  const checklist = read("docs/db-restore-checklist.md");

  assert.match(checklist, /SHA256/);
  assert.match(checklist, /base temporal/);
  assert.match(checklist, /pg_restore/);
  assert.match(checklist, /npx prisma migrate deploy/);
  assert.match(checklist, /\/api\/health/);
  assert.match(checklist, /No correr `prisma migrate dev` contra Railway o producción/);
});

test("script de backup guarda fuera del repo y genera checksum", () => {
  const script = read("scripts/db-backup.ps1");

  assert.match(script, /rad-db-backups/);
  assert.match(script, /pg_dump/);
  assert.match(script, /--format custom/);
  assert.match(script, /--no-owner/);
  assert.match(script, /--no-acl/);
  assert.match(script, /Get-FileHash -Algorithm SHA256/);
  assert.match(script, /NO subas este backup a Git/);
  assert.doesNotMatch(script, /git add/);
});
