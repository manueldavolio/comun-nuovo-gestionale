import type {
  SensitiveDocumentAccessAction,
  SensitiveDocumentAccessOutcome,
  SensitiveDocumentResourceType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SensitiveDocumentAccessLogInput = {
  userId: string;
  userRole: UserRole;
  action: SensitiveDocumentAccessAction;
  resourceType: SensitiveDocumentResourceType;
  resourceId: string;
  documentType?: string | null;
  athleteId?: string | null;
  outcome: SensitiveDocumentAccessOutcome;
  reason?: string | null;
};

export class SensitiveDocumentAccessLogError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SensitiveDocumentAccessLogError";
  }
}

async function writeSensitiveDocumentAccess(
  input: SensitiveDocumentAccessLogInput,
): Promise<void> {
  await prisma.sensitiveDocumentAccessLog.create({
    data: {
      userId: input.userId,
      userRole: input.userRole,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      documentType: input.documentType ?? null,
      athleteId: input.athleteId ?? null,
      outcome: input.outcome,
      reason: input.reason ?? null,
    },
  });
}

/**
 * Audit best-effort (tipicamente DENIED): non interrompe il flusso se il log fallisce.
 */
export async function recordSensitiveDocumentAccess(
  input: SensitiveDocumentAccessLogInput,
): Promise<void> {
  try {
    await writeSensitiveDocumentAccess(input);
  } catch (error) {
    console.error("[sensitive-document-access-log] write failed", {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      outcome: input.outcome,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Audit obbligatorio per download/view ALLOWED.
 * Se fallisce, il chiamante NON deve consegnare il documento.
 */
export async function recordSensitiveDocumentAccessRequired(
  input: SensitiveDocumentAccessLogInput,
): Promise<void> {
  try {
    await writeSensitiveDocumentAccess(input);
  } catch (error) {
    console.error("[sensitive-document-access-log] required write failed", {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      outcome: input.outcome,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new SensitiveDocumentAccessLogError(
      "Impossibile registrare l'accesso al documento. Download interrotto.",
      error,
    );
  }
}
