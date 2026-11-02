import type { LegalDocumentKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  IMAGE_MEDIA_CONSENT_V1_BODY,
  IMAGE_MEDIA_CONSENT_V1_TITLE,
  IMAGE_MEDIA_CONSENT_V1_VERSION,
  PRIVACY_NOTICE_V1_BODY,
  PRIVACY_NOTICE_V1_TITLE,
  PRIVACY_NOTICE_V1_VERSION,
  SOCIETY_REGULATION_V1_BODY,
  SOCIETY_REGULATION_V1_TITLE,
  SOCIETY_REGULATION_V1_VERSION,
} from "@/lib/legal/document-bodies";
import { sha256HexOfLegalDocumentBody } from "@/lib/legal/hash";
import {
  type CurrentLegalDocument,
  buildEnrollmentConsentAuditFields,
  formatLegalPublicationDate,
} from "@/lib/legal/consent-audit";

export type { CurrentLegalDocument, EnrollmentConsentAuditFields } from "@/lib/legal/consent-audit";
export { buildEnrollmentConsentAuditFields, formatLegalPublicationDate };

export const LEGAL_DOCUMENT_FALLBACKS: Record<
  LegalDocumentKind,
  { version: string; title: string; bodyText: string }
> = {
  PRIVACY_NOTICE: {
    version: PRIVACY_NOTICE_V1_VERSION,
    title: PRIVACY_NOTICE_V1_TITLE,
    bodyText: PRIVACY_NOTICE_V1_BODY,
  },
  SOCIETY_REGULATION: {
    version: SOCIETY_REGULATION_V1_VERSION,
    title: SOCIETY_REGULATION_V1_TITLE,
    bodyText: SOCIETY_REGULATION_V1_BODY,
  },
  IMAGE_MEDIA_CONSENT: {
    version: IMAGE_MEDIA_CONSENT_V1_VERSION,
    title: IMAGE_MEDIA_CONSENT_V1_TITLE,
    bodyText: IMAGE_MEDIA_CONSENT_V1_BODY,
  },
};

export function toCurrentLegalDocument(input: {
  kind: LegalDocumentKind;
  version: string;
  title: string;
  bodyText: string;
  contentSha256: string;
  effectiveFrom: Date | null;
}): CurrentLegalDocument {
  return {
    kind: input.kind,
    version: input.version,
    title: input.title,
    bodyText: input.bodyText,
    contentSha256: input.contentSha256,
    effectiveFrom: input.effectiveFrom,
  };
}

export async function getCurrentLegalDocument(
  kind: LegalDocumentKind,
): Promise<CurrentLegalDocument | null> {
  const row = await prisma.legalDocument.findFirst({
    where: { kind, isCurrent: true },
    select: {
      kind: true,
      version: true,
      title: true,
      bodyText: true,
      contentSha256: true,
      effectiveFrom: true,
    },
  });
  if (!row) return null;
  return toCurrentLegalDocument(row);
}

export async function requireCurrentLegalDocuments(kinds: LegalDocumentKind[]) {
  const docs = await Promise.all(kinds.map((kind) => getCurrentLegalDocument(kind)));
  const missing = kinds.filter((kind, index) => !docs[index]);
  if (missing.length > 0) {
    return { ok: false as const, missing };
  }
  return {
    ok: true as const,
    documents: Object.fromEntries(
      kinds.map((kind, index) => [kind, docs[index]!]),
    ) as Record<LegalDocumentKind, CurrentLegalDocument>,
  };
}

export function buildLegalDocumentSeedRows(now = new Date()): Prisma.LegalDocumentCreateManyInput[] {
  const kinds = [
    {
      kind: "PRIVACY_NOTICE" as const,
      version: PRIVACY_NOTICE_V1_VERSION,
      title: PRIVACY_NOTICE_V1_TITLE,
      bodyText: PRIVACY_NOTICE_V1_BODY,
    },
    {
      kind: "SOCIETY_REGULATION" as const,
      version: SOCIETY_REGULATION_V1_VERSION,
      title: SOCIETY_REGULATION_V1_TITLE,
      bodyText: SOCIETY_REGULATION_V1_BODY,
    },
    {
      kind: "IMAGE_MEDIA_CONSENT" as const,
      version: IMAGE_MEDIA_CONSENT_V1_VERSION,
      title: IMAGE_MEDIA_CONSENT_V1_TITLE,
      bodyText: IMAGE_MEDIA_CONSENT_V1_BODY,
    },
  ];

  return kinds.map((item) => ({
    kind: item.kind,
    version: item.version,
    title: item.title,
    bodyText: item.bodyText,
    contentSha256: sha256HexOfLegalDocumentBody(item.bodyText),
    effectiveFrom: null,
    retiredAt: null,
    isCurrent: true,
    createdAt: now,
    updatedAt: now,
  }));
}
