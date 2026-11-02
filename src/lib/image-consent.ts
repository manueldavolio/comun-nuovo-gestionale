import type { ImageConsentChoice, ImageConsentPurpose, LegalDocumentKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDualImageConsentV11Active } from "@/lib/legal/image-consent-activation";
import { getCurrentLegalDocument } from "@/lib/legal/legal-documents";
import {
  allowsExternalPublication,
  allowsInternalUse,
  choiceImpliesGrant,
  computeMediaReviewStatus,
  parentVisibleMediaWhere,
  suspensionWarningForChoiceChange,
  type AthleteImageConsentState,
} from "@/lib/image-consent-policy";

export type { AthleteImageConsentState };
export {
  allowsExternalPublication,
  allowsInternalUse,
  choiceImpliesGrant,
  computeMediaReviewStatus,
  parentVisibleMediaWhere,
  suspensionWarningForChoiceChange,
};

const PURPOSE_DOCUMENT_KIND: Record<ImageConsentPurpose, LegalDocumentKind> = {
  INTERNAL: "IMAGE_CONSENT_INTERNAL",
  EXTERNAL: "IMAGE_CONSENT_EXTERNAL",
};

function emptyState(
  athleteId: string,
  purpose: ImageConsentPurpose | null = null,
): AthleteImageConsentState {
  return {
    athleteId,
    granted: false,
    choice: null,
    purpose,
    source: "none",
    recordedAt: null,
    documentVersion: null,
    legacyHistoricalOnly: false,
  };
}

async function resolveLegacyMonolithicGrant(athleteId: string): Promise<{
  granted: boolean;
  recordedAt: Date | null;
  documentVersion: string | null;
  source: "event" | "enrollment" | "none";
}> {
  const latestLegacyEvent = await prisma.athleteImageConsentEvent.findFirst({
    where: { athleteId, purpose: null },
    orderBy: { recordedAt: "desc" },
    select: {
      granted: true,
      recordedAt: true,
      documentVersion: true,
    },
  });

  if (latestLegacyEvent) {
    return {
      granted: latestLegacyEvent.granted,
      recordedAt: latestLegacyEvent.recordedAt,
      documentVersion: latestLegacyEvent.documentVersion,
      source: "event",
    };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { athleteId },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: {
      imageConsent: true,
      submittedAt: true,
      createdAt: true,
      imageConsentVersion: true,
    },
  });

  if (enrollment) {
    return {
      granted: enrollment.imageConsent,
      recordedAt: enrollment.submittedAt ?? enrollment.createdAt,
      documentVersion: enrollment.imageConsentVersion,
      source: "enrollment",
    };
  }

  return { granted: false, recordedAt: null, documentVersion: null, source: "none" };
}

/**
 * Risolve lo stato per una finalità.
 * - dual 1.1 attivo: solo scelte purpose-specifiche; 1.0 è storico non abilitante.
 * - dual non attivo: fallback operativo al consenso monolitico 1.0 (senza convertirlo).
 */
export async function resolveAthleteImageConsentForPurpose(
  athleteId: string,
  purpose: ImageConsentPurpose,
): Promise<AthleteImageConsentState> {
  const dualActive = await isDualImageConsentV11Active();
  const legacy = await resolveLegacyMonolithicGrant(athleteId);

  // Finché dual 1.1 non è attivo, gli eventi purpose-specifici non sono operativi
  // (restano in storico). Così un rollback ripristina subito il comportamento 1.0.
  if (!dualActive) {
    if (purpose === "EXTERNAL" && legacy.granted) {
      return {
        athleteId,
        granted: true,
        choice: "GRANTED",
        purpose: "EXTERNAL",
        source: legacy.source === "none" ? "none" : legacy.source,
        recordedAt: legacy.recordedAt,
        documentVersion: legacy.documentVersion,
        legacyHistoricalOnly: false,
      };
    }

    if (purpose === "EXTERNAL" && legacy.source !== "none") {
      return {
        athleteId,
        granted: false,
        choice: "DENIED",
        purpose: "EXTERNAL",
        source: legacy.source,
        recordedAt: legacy.recordedAt,
        documentVersion: legacy.documentVersion,
        legacyHistoricalOnly: false,
      };
    }

    return emptyState(athleteId, purpose);
  }

  const latestPurposeEvent = await prisma.athleteImageConsentEvent.findFirst({
    where: { athleteId, purpose },
    orderBy: { recordedAt: "desc" },
    select: {
      granted: true,
      choice: true,
      purpose: true,
      recordedAt: true,
      documentVersion: true,
    },
  });

  if (latestPurposeEvent) {
    const choice = latestPurposeEvent.choice;
    return {
      athleteId,
      granted: choiceImpliesGrant(choice) && latestPurposeEvent.granted,
      choice,
      purpose: latestPurposeEvent.purpose,
      source: "event",
      recordedAt: latestPurposeEvent.recordedAt,
      documentVersion: latestPurposeEvent.documentVersion,
      legacyHistoricalOnly: false,
    };
  }

  if (legacy.source !== "none" && legacy.granted) {
    return {
      athleteId,
      granted: false,
      choice: null,
      purpose: null,
      source: "legacy",
      recordedAt: legacy.recordedAt,
      documentVersion: legacy.documentVersion,
      legacyHistoricalOnly: true,
    };
  }

  return emptyState(athleteId, purpose);
}

export async function resolveAthleteImageConsent(
  athleteId: string,
): Promise<AthleteImageConsentState> {
  return resolveAthleteImageConsentForPurpose(athleteId, "EXTERNAL");
}

export async function resolveAthletesImageConsentMap(
  athleteIds: string[],
  purpose: ImageConsentPurpose = "EXTERNAL",
): Promise<Map<string, AthleteImageConsentState>> {
  const unique = Array.from(new Set(athleteIds));
  const entries = await Promise.all(
    unique.map((id) => resolveAthleteImageConsentForPurpose(id, purpose)),
  );
  return new Map(entries.map((entry) => [entry.athleteId, entry]));
}

async function blockExternalMediaForAthlete(athleteId: string) {
  await prisma.mediaItem.updateMany({
    where: {
      subjects: { some: { athleteId } },
      reviewStatus: { in: ["READY", "NEEDS_REVIEW"] },
    },
    data: { reviewStatus: "BLOCKED_CONSENT", publishedAt: null },
  });
}

export async function recordAthleteImageConsentChoice(input: {
  athleteId: string;
  purpose: ImageConsentPurpose;
  choice: ImageConsentChoice;
  actedByUserId: string;
  source?: string;
  note?: string | null;
  recordedAt?: Date;
}) {
  const dualActive = await isDualImageConsentV11Active();
  if (!dualActive) {
    throw new Error("DUAL_IMAGE_CONSENT_NOT_ACTIVE");
  }

  const kind = PURPOSE_DOCUMENT_KIND[input.purpose];
  const doc = await getCurrentLegalDocument(kind);
  if (!doc) {
    throw new Error(`${kind}_DOCUMENT_MISSING`);
  }

  const previous = await resolveAthleteImageConsentForPurpose(input.athleteId, input.purpose);
  const recordedAt = input.recordedAt ?? new Date();
  const granted = choiceImpliesGrant(input.choice);
  const warning = suspensionWarningForChoiceChange({
    previousChoice: previous.legacyHistoricalOnly ? null : previous.choice,
    nextChoice: input.choice,
  });

  const event = await prisma.athleteImageConsentEvent.create({
    data: {
      athleteId: input.athleteId,
      granted,
      purpose: input.purpose,
      choice: input.choice,
      legalDocumentKind: kind,
      documentVersion: doc.version,
      documentContentSha256: doc.contentSha256,
      recordedAt,
      actedByUserId: input.actedByUserId,
      source: input.source ?? null,
      note: input.note ?? null,
    },
    select: {
      id: true,
      granted: true,
      purpose: true,
      choice: true,
      recordedAt: true,
      documentVersion: true,
    },
  });

  if (input.purpose === "EXTERNAL" && !granted) {
    await blockExternalMediaForAthlete(input.athleteId);
  }

  return { event, warning, previous };
}

/** Registrazione consenso monolitico 1.0 (solo se dual 1.1 non è attivo). */
export async function recordAthleteImageConsentEvent(input: {
  athleteId: string;
  granted: boolean;
  actedByUserId: string;
  source?: string;
  note?: string | null;
  recordedAt?: Date;
}) {
  const dualActive = await isDualImageConsentV11Active();
  if (dualActive) {
    const result = await recordAthleteImageConsentChoice({
      athleteId: input.athleteId,
      purpose: "EXTERNAL",
      choice: input.granted ? "GRANTED" : "DENIED",
      actedByUserId: input.actedByUserId,
      source: input.source,
      note: input.note,
      recordedAt: input.recordedAt,
    });
    return result.event;
  }

  const doc = await getCurrentLegalDocument("IMAGE_MEDIA_CONSENT");
  if (!doc) {
    throw new Error("IMAGE_MEDIA_CONSENT_DOCUMENT_MISSING");
  }

  const recordedAt = input.recordedAt ?? new Date();
  const event = await prisma.athleteImageConsentEvent.create({
    data: {
      athleteId: input.athleteId,
      granted: input.granted,
      purpose: null,
      choice: null,
      legalDocumentKind: "IMAGE_MEDIA_CONSENT",
      documentVersion: doc.version,
      documentContentSha256: doc.contentSha256,
      recordedAt,
      actedByUserId: input.actedByUserId,
      source: input.source ?? null,
      note: input.note ?? null,
    },
    select: { id: true, granted: true, recordedAt: true, documentVersion: true },
  });

  if (!input.granted) {
    await blockExternalMediaForAthlete(input.athleteId);
  }

  return event;
}
