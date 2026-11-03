import type { DocumentType, PaymentStatus, PrismaClient } from "@prisma/client";
import { deleteEnrollmentDocumentsBestEffort } from "@/lib/enrollment-documents";
import { isHealthArchiveDocumentType } from "@/lib/health-data-access";

export const ATHLETE_DELETE_CONFIRM_TOKEN = "ELIMINA";

export const ATHLETE_NOT_DELETABLE_FINANCIAL_MESSAGE =
  "Atleta non eliminabile: sono presenti pagamenti o movimenti contabili.";

export const ATHLETE_NOT_DELETABLE_HEALTH_ATTACHMENTS_MESSAGE =
  "Atleta non eliminabile: sono presenti certificati medici o allegati sanitari. Contatta la segreteria per una procedura guidata; i file non vengono cancellati automaticamente.";

type PaymentFinancialSnapshot = {
  id: string;
  status: PaymentStatus;
  paidAt: Date | null;
  receipt: { id: string } | null;
  accountingEntry: { id: string } | null;
};

export type AthleteDeleteFinancialAssessment =
  | { ok: true }
  | {
      ok: false;
      reason: "PAID_PAYMENT" | "PAID_AT" | "RECEIPT" | "ACCOUNTING_ENTRY";
      message: string;
    };

export function assessAthleteFinancialDeletability(
  payments: PaymentFinancialSnapshot[],
): AthleteDeleteFinancialAssessment {
  for (const payment of payments) {
    if (payment.status === "PAID") {
      return {
        ok: false,
        reason: "PAID_PAYMENT",
        message: ATHLETE_NOT_DELETABLE_FINANCIAL_MESSAGE,
      };
    }

    if (payment.paidAt != null) {
      return {
        ok: false,
        reason: "PAID_AT",
        message: ATHLETE_NOT_DELETABLE_FINANCIAL_MESSAGE,
      };
    }

    if (payment.receipt) {
      return {
        ok: false,
        reason: "RECEIPT",
        message: ATHLETE_NOT_DELETABLE_FINANCIAL_MESSAGE,
      };
    }

    if (payment.accountingEntry) {
      return {
        ok: false,
        reason: "ACCOUNTING_ENTRY",
        message: ATHLETE_NOT_DELETABLE_FINANCIAL_MESSAGE,
      };
    }
  }

  return { ok: true };
}

export type AdminAthleteDeleteSuccess = {
  ok: true;
  athleteId: string;
  firstName: string;
  lastName: string;
  parentProfileId: string;
  categoryId: string;
  leftoverStoragePaths: string[];
  storageCleanup: {
    attempted: number;
    removed: number;
    failed: string[];
  };
};

export type AthleteHealthAttachmentAssessment =
  | { ok: true }
  | {
      ok: false;
      reason: "MEDICAL_VISIT_CERTIFICATE" | "ARCHIVE_MEDICAL_CERTIFICATE";
      message: string;
    };

/**
 * Blocca l'eliminazione definitiva se esistono allegati sanitari (certificati).
 * Non cancella file: solo valutazione.
 */
export function assessAthleteHealthAttachmentDeletability(input: {
  medicalVisits: Array<{ certificateFilePath: string | null }>;
  documents: Array<{ type?: DocumentType | string | null; filePath?: string | null }>;
}): AthleteHealthAttachmentAssessment {
  for (const visit of input.medicalVisits) {
    if (visit.certificateFilePath?.trim()) {
      return {
        ok: false,
        reason: "MEDICAL_VISIT_CERTIFICATE",
        message: ATHLETE_NOT_DELETABLE_HEALTH_ATTACHMENTS_MESSAGE,
      };
    }
  }

  for (const document of input.documents) {
    if (isHealthArchiveDocumentType(document.type ?? null)) {
      return {
        ok: false,
        reason: "ARCHIVE_MEDICAL_CERTIFICATE",
        message: ATHLETE_NOT_DELETABLE_HEALTH_ATTACHMENTS_MESSAGE,
      };
    }
  }

  return { ok: true };
}

export type AdminAthleteDeleteFailure = {
  ok: false;
  status: 404 | 409;
  error: string;
  reason?:
    | "PAID_PAYMENT"
    | "PAID_AT"
    | "RECEIPT"
    | "ACCOUNTING_ENTRY"
    | "MEDICAL_VISIT_CERTIFICATE"
    | "ARCHIVE_MEDICAL_CERTIFICATE";
};

export type AdminAthleteDeleteResult = AdminAthleteDeleteSuccess | AdminAthleteDeleteFailure;

export async function deleteAthleteAsAdmin(options: {
  athleteId: string;
  prisma: PrismaClient;
  cleanupEnrollmentStorage?: (paths: string[]) => Promise<{ removed: string[]; failed: string[] }>;
}): Promise<AdminAthleteDeleteResult> {
  const athleteId = options.athleteId.trim();
  if (!athleteId) {
    return { ok: false, status: 404, error: "Atleta non trovato." };
  }

  const athlete = await options.prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentId: true,
      categoryId: true,
      documents: {
        select: { type: true, filePath: true },
      },
      medicalVisits: {
        select: { certificateFilePath: true },
      },
      enrollments: {
        select: {
          documents: {
            select: { filePath: true },
          },
          payments: {
            select: {
              id: true,
              status: true,
              paidAt: true,
              receipt: { select: { id: true } },
              accountingEntry: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!athlete) {
    return { ok: false, status: 404, error: "Atleta non trovato." };
  }

  const payments = athlete.enrollments.flatMap((enrollment) => enrollment.payments);
  const assessment = assessAthleteFinancialDeletability(payments);
  if (!assessment.ok) {
    return {
      ok: false,
      status: 409,
      error: assessment.message,
      reason: assessment.reason,
    };
  }

  const healthAssessment = assessAthleteHealthAttachmentDeletability({
    medicalVisits: athlete.medicalVisits,
    documents: athlete.documents,
  });
  if (!healthAssessment.ok) {
    return {
      ok: false,
      status: 409,
      error: healthAssessment.message,
      reason: healthAssessment.reason,
    };
  }

  const enrollmentDocumentPaths = athlete.enrollments.flatMap((enrollment) =>
    enrollment.documents.map((document) => document.filePath).filter(Boolean),
  );
  const otherStoragePaths = [
    ...athlete.documents.map((document) => document.filePath).filter(Boolean),
    ...athlete.medicalVisits
      .map((visit) => visit.certificateFilePath)
      .filter((path): path is string => Boolean(path?.trim())),
  ];

  const nonPaidPaymentIds = payments
    .filter((payment) => payment.status !== "PAID")
    .map((payment) => payment.id);

  await options.prisma.$transaction(async (tx) => {
    if (nonPaidPaymentIds.length > 0) {
      await tx.accountingEntry.deleteMany({
        where: {
          paymentId: { in: nonPaidPaymentIds },
        },
      });
    }

    await tx.athlete.delete({
      where: { id: athlete.id },
    });
  });

  const cleanup =
    options.cleanupEnrollmentStorage ??
    ((paths: string[]) => deleteEnrollmentDocumentsBestEffort(paths));

  const storageCleanup = await cleanup(enrollmentDocumentPaths);

  return {
    ok: true,
    athleteId: athlete.id,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    parentProfileId: athlete.parentId,
    categoryId: athlete.categoryId,
    leftoverStoragePaths: [...storageCleanup.failed, ...otherStoragePaths],
    storageCleanup: {
      attempted: enrollmentDocumentPaths.length,
      removed: storageCleanup.removed.length,
      failed: storageCleanup.failed,
    },
  };
}
