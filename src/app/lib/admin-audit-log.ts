import { prisma } from "@/app/lib/prisma";

type JsonPrimitive = string | number | boolean | null;
type AdminAuditMetadata = Record<string, JsonPrimitive | JsonPrimitive[]>;

export type AdminAuditAction =
  | "admin_review_deleted"
  | "admin_review_report_status_changed"
  | "admin_reply_report_status_changed";

export type AdminAuditTargetType =
  | "review"
  | "review_report"
  | "reply_report";

export async function logAdminAuditEvent({
  adminUsername,
  action,
  targetType,
  targetId,
  day,
  metadata,
}: {
  adminUsername: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId?: string | null;
  day?: string | null;
  metadata?: AdminAuditMetadata;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUsername,
        action,
        targetType,
        targetId: targetId ?? null,
        day: day ?? null,
        metadata: metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("admin audit log error:", error);
  }
}
