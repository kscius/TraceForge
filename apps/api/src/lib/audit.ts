import { AuditSource, prisma } from "@traceforge/db";

type AuditInput = {
  workspaceId?: string;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId?: string;
  actorLabel?: string;
  source: AuditSource;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
      source: input.source,
      previousValue: input.previousValue as object | undefined,
      newValue: input.newValue as object | undefined,
      metadata: input.metadata as object | undefined,
    },
  });
}
