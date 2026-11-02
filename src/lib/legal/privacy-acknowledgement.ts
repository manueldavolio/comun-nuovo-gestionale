import { prisma } from "@/lib/prisma";
import { getCurrentLegalDocument } from "@/lib/legal/legal-documents";

export async function getLatestPrivacyNoticeAcknowledgement(userId: string) {
  return prisma.privacyNoticeAcknowledgement.findFirst({
    where: { userId },
    orderBy: { acknowledgedAt: "desc" },
    select: {
      id: true,
      documentVersion: true,
      documentContentSha256: true,
      acknowledgedAt: true,
      source: true,
    },
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

  const acknowledgedAt = input.acknowledgedAt ?? new Date();
  return prisma.privacyNoticeAcknowledgement.upsert({
    where: {
      userId_documentVersion: {
        userId: input.userId,
        documentVersion: doc.version,
      },
    },
    create: {
      userId: input.userId,
      documentVersion: doc.version,
      documentContentSha256: doc.contentSha256,
      acknowledgedAt,
      source: input.source ?? "parent_area",
    },
    update: {
      documentContentSha256: doc.contentSha256,
      acknowledgedAt,
      source: input.source ?? "parent_area",
    },
    select: {
      id: true,
      documentVersion: true,
      documentContentSha256: true,
      acknowledgedAt: true,
    },
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
