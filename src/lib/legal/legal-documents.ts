import type { LegalDocumentKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type CurrentLegalDocument,
  buildEnrollmentConsentAuditFields,
  buildEnrollmentConsentAuditFieldsDual,
  formatLegalPublicationDate,
} from "@/lib/legal/consent-audit";
import {
  LEGAL_DOCUMENT_FALLBACKS,
  buildLegalDocumentSeedRows,
} from "@/lib/legal/legal-document-seed";

export type { CurrentLegalDocument, EnrollmentConsentAuditFields } from "@/lib/legal/consent-audit";
export {
  buildEnrollmentConsentAuditFields,
  buildEnrollmentConsentAuditFieldsDual,
  formatLegalPublicationDate,
};
export { LEGAL_DOCUMENT_FALLBACKS, buildLegalDocumentSeedRows };

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
