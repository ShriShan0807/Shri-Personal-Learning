import { prisma } from "./prisma";

export async function audit(args: {
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: args.actorUserId ?? null,
        action: args.action,
        entity: args.entity,
        entityId: args.entityId ?? null,
        metadata: args.metadata ? JSON.stringify(args.metadata) : null,
      },
    });
  } catch (e) {
    // Auditing must never break the primary operation.
    console.error("Audit log failed:", e);
  }
}
