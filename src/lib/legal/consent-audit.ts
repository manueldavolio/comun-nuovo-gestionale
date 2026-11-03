import type { ImageConsentChoice, LegalDocumentKind } from "@prisma/client";

export type CurrentLegalDocument = {
  kind: LegalDocumentKind;
  version: string;
  title: string;
  bodyText: string;
  contentSha256: string;
  effectiveFrom: Date | null;
};

export type EnrollmentConsentAuditFields = {
  privacyNoticeVersion: string;
  privacyNoticeContentSha256: string;
  privacyNoticeAcknowledgedAt: Date;
  regulationVersion: string;
  regulationContentSha256: string;
  regulationAcceptedAt: Date;
  imageConsentVersion: string | null;
  imageConsentContentSha256: string | null;
  imageConsentRecordedAt: Date | null;
  consentAuditStatus: "COMPLETE";
};

export function buildEnrollmentConsentAuditFields(input: {
  privacyNotice: CurrentLegalDocument;
  regulation: CurrentLegalDocument;
  imageConsentDoc: CurrentLegalDocument;
  imageConsentGranted: boolean;
  recordedAt: Date;
}): EnrollmentConsentAuditFields {
  return {
    privacyNoticeVersion: input.privacyNotice.version,
    privacyNoticeContentSha256: input.privacyNotice.contentSha256,
    privacyNoticeAcknowledgedAt: input.recordedAt,
    regulationVersion: input.regulation.version,
    regulationContentSha256: input.regulation.contentSha256,
    regulationAcceptedAt: input.recordedAt,
    imageConsentVersion: input.imageConsentGranted ? input.imageConsentDoc.version : null,
    imageConsentContentSha256: input.imageConsentGranted
      ? input.imageConsentDoc.contentSha256
      : null,
    imageConsentRecordedAt: input.imageConsentGranted ? input.recordedAt : null,
    consentAuditStatus: "COMPLETE",
  };
}

export function buildEnrollmentConsentAuditFieldsDual(input: {
  privacyNotice: CurrentLegalDocument;
  regulation: CurrentLegalDocument;
  imageConsentExternalDoc: CurrentLegalDocument;
  imageConsentExternalChoice: ImageConsentChoice;
  recordedAt: Date;
}): EnrollmentConsentAuditFields {
  return buildEnrollmentConsentAuditFields({
    privacyNotice: input.privacyNotice,
    regulation: input.regulation,
    imageConsentDoc: input.imageConsentExternalDoc,
    imageConsentGranted: input.imageConsentExternalChoice === "GRANTED",
    recordedAt: input.recordedAt,
  });
}

export function formatLegalPublicationDate(effectiveFrom: Date | null): string {
  if (!effectiveFrom) {
    return "Data di pubblicazione: all'attivazione in produzione (go-live)";
  }
  return effectiveFrom.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

/**
 * Confronta la versione/hash mostrati al genitore con il documento corrente server-side.
 * I valori "shown" servono solo al controllo mismatch: lo stamp usa sempre i campi current.
 */
export function privacyNoticeShownMatchesCurrent(input: {
  shownVersion: string;
  shownContentSha256: string;
  currentVersion: string;
  currentContentSha256: string;
}): boolean {
  return (
    input.shownVersion === input.currentVersion &&
    input.shownContentSha256 === input.currentContentSha256
  );
}
