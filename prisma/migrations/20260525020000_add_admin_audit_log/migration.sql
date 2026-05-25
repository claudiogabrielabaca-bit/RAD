CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "adminUsername" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "day" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_admin_created_at_idx" ON "AdminAuditLog"("adminUsername", "createdAt");
CREATE INDEX "admin_audit_action_created_at_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX "admin_audit_target_idx" ON "AdminAuditLog"("targetType", "targetId");
CREATE INDEX "admin_audit_day_idx" ON "AdminAuditLog"("day");
