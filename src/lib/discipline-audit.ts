import type {
  DisciplinaryAuditAction,
  DisciplinaryAuditEntityType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function writeDisciplinaryAudit(params: {
  entityType: DisciplinaryAuditEntityType;
  entityId: string;
  action: DisciplinaryAuditAction;
  userId: string;
  before?: unknown;
  after?: unknown;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  await client.disciplinaryAuditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      beforeJson: (params.before ?? undefined) as Prisma.InputJsonValue | undefined,
      afterJson: (params.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
