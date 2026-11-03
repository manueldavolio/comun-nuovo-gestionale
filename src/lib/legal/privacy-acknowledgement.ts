import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentLegalDocument } from "@/lib/legal/legal-documents";

type PrivacyAckClient = Pick<Prisma.TransactionClient, "privacyNoticeAcknowledgement">;

const PRIVACY_ACK_SELECT = {
  id: true,
  documentVersion: true,
  documentContentSha256: true,
  acknowledgedAt: true,
  source: true,
} as const;

/**
 * Registra una presa visione esplicita sulla versione/hash indicati.
 * Non inventa accettazioni: va chiamata solo dopo azione utente (checkbox / conferma).
 */
export async function recordPrivacyNoticeAcknowledgement(
  input: {
    userId: string;
    documentVersion: string;
    documentContentSha256: string;
    source: string;
    acknowledgedAt?: Date;
  },
  client: PrivacyAckClient = prisma,
) {
  const acknowledgedAt = input.acknowledgedAt ?? new Date();
  return client.privacyNoticeAcknowledgement.upsert({
    where: {
      userId_documentVersion: {
        userId: input.userId,
        documentVersion: input.documentVersion,
      },
    },
    create: {
      userId: input.userId,
      documentVersion: input.documentVersion,
      documentContentSha256: input.documentContentSha256,
      acknowledgedAt,
      source: input.source,
    },
    update: {
      documentContentSha256: input.documentContentSha256,
      acknowledgedAt,
      source: input.source,
    },
    select: PRIVACY_ACK_SELECT,
  });
}

export async function getLatestPrivacyNoticeAcknowledgement(userId: string) {
  return prisma.privacyNoticeAcknowledgement.findFirst({
    where: { userId },
    orderBy: { acknowledgedAt: "desc" },
    select: PRIVACY_ACK_SELECT,
  });
}

export async function acknowledgeCurrentPrivacyNotice(input: {
  userId: string;
  source?: string;
  acknowledgedAt?: Date;
}) {
  const doc = await getCurrentLegalDocument("PRIVACY_NOTICE");
  if (!doc) {
    throw new Error("PRIVACY_NOTICE_DOCUMENT_MISSING");
  }

  return recordPrivacyNoticeAcknowledgement({
    userId: input.userId,
    documentVersion: doc.version,
    documentContentSha256: doc.contentSha256,
    source: input.source ?? "parent_area",
    acknowledgedAt: input.acknowledgedAt,
  });
}

export async function hasAcknowledgedCurrentPrivacyNotice(userId: string): Promise<boolean> {
  const doc = await getCurrentLegalDocument("PRIVACY_NOTICE");
  if (!doc) return false;
  const row = await prisma.privacyNoticeAcknowledgement.findUnique({
    where: {
      userId_documentVersion: {
        userId,
        documentVersion: doc.version,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}
