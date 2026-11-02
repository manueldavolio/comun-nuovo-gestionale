import type { LegalDocumentKind, Prisma } from "@prisma/client";
import {
  IMAGE_CONSENT_EXTERNAL_V1_1_BODY,
  IMAGE_CONSENT_EXTERNAL_V1_1_TITLE,
  IMAGE_CONSENT_EXTERNAL_V1_1_VERSION,
  IMAGE_CONSENT_INTERNAL_V1_1_BODY,
  IMAGE_CONSENT_INTERNAL_V1_1_TITLE,
  IMAGE_CONSENT_INTERNAL_V1_1_VERSION,
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
  IMAGE_CONSENT_INTERNAL: {
    version: IMAGE_CONSENT_INTERNAL_V1_1_VERSION,
    title: IMAGE_CONSENT_INTERNAL_V1_1_TITLE,
    bodyText: IMAGE_CONSENT_INTERNAL_V1_1_BODY,
  },
  IMAGE_CONSENT_EXTERNAL: {
    version: IMAGE_CONSENT_EXTERNAL_V1_1_VERSION,
    title: IMAGE_CONSENT_EXTERNAL_V1_1_TITLE,
    bodyText: IMAGE_CONSENT_EXTERNAL_V1_1_BODY,
  },
};

/**
 * Seed documenti legali (idempotente a livello di createMany skipDuplicates lato script).
 * - Privacy resta 1.0 current.
 * - IMAGE_MEDIA_CONSENT 1.0 resta current fino ad attivazione esplicita dual 1.1.
 * - INTERNAL/EXTERNAL 1.1 sono inseriti in catalogo ma NON current e senza effectiveFrom.
 */
export function buildLegalDocumentSeedRows(now = new Date()): Prisma.LegalDocumentCreateManyInput[] {
  const kinds: Array<{
    kind: LegalDocumentKind;
    version: string;
    title: string;
    bodyText: string;
    isCurrent: boolean;
  }> = [
    {
      kind: "PRIVACY_NOTICE",
      version: PRIVACY_NOTICE_V1_VERSION,
      title: PRIVACY_NOTICE_V1_TITLE,
      bodyText: PRIVACY_NOTICE_V1_BODY,
      isCurrent: true,
    },
    {
      kind: "SOCIETY_REGULATION",
      version: SOCIETY_REGULATION_V1_VERSION,
      title: SOCIETY_REGULATION_V1_TITLE,
      bodyText: SOCIETY_REGULATION_V1_BODY,
      isCurrent: true,
    },
    {
      kind: "IMAGE_MEDIA_CONSENT",
      version: IMAGE_MEDIA_CONSENT_V1_VERSION,
      title: IMAGE_MEDIA_CONSENT_V1_TITLE,
      bodyText: IMAGE_MEDIA_CONSENT_V1_BODY,
      isCurrent: true,
    },
    {
      kind: "IMAGE_CONSENT_INTERNAL",
      version: IMAGE_CONSENT_INTERNAL_V1_1_VERSION,
      title: IMAGE_CONSENT_INTERNAL_V1_1_TITLE,
      bodyText: IMAGE_CONSENT_INTERNAL_V1_1_BODY,
      isCurrent: false,
    },
    {
      kind: "IMAGE_CONSENT_EXTERNAL",
      version: IMAGE_CONSENT_EXTERNAL_V1_1_VERSION,
      title: IMAGE_CONSENT_EXTERNAL_V1_1_TITLE,
      bodyText: IMAGE_CONSENT_EXTERNAL_V1_1_BODY,
      isCurrent: false,
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
    isCurrent: item.isCurrent,
    createdAt: now,
    updatedAt: now,
  }));
}
