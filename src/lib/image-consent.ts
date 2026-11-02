import { prisma } from "@/lib/prisma";
import { getCurrentLegalDocument } from "@/lib/legal/legal-documents";
import {
  computeMediaReviewStatus,
  parentVisibleMediaWhere,
  type AthleteImageConsentState,
} from "@/lib/image-consent-policy";

export type { AthleteImageConsentState };
export { computeMediaReviewStatus, parentVisibleMediaWhere };

export async function resolveAthleteImageConsent(
  athleteId: string,
): Promise<AthleteImageConsentState> {
  const latestEvent = await prisma.athleteImageConsentEvent.findFirst({
    where: { athleteId },
    orderBy: { recordedAt: "desc" },
    select: {
      granted: true,
      recordedAt: true,
      documentVersion: true,
    },
  });

  if (latestEvent) {
    return {
      athleteId,
      granted: latestEvent.granted,
      source: "event",
      recordedAt: latestEvent.recordedAt,
      documentVersion: latestEvent.documentVersion,
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
      athleteId,
      granted: enrollment.imageConsent,
      source: "enrollment",
      recordedAt: enrollment.submittedAt ?? enrollment.createdAt,
      documentVersion: enrollment.imageConsentVersion,
    };
  }

  return {
    athleteId,
    granted: false,
    source: "none",
    recordedAt: null,
    documentVersion: null,
  };
}

export async function resolveAthletesImageConsentMap(
  athleteIds: string[],
): Promise<Map<string, AthleteImageConsentState>> {
  const unique = Array.from(new Set(athleteIds));
  const entries = await Promise.all(unique.map((id) => resolveAthleteImageConsent(id)));
  return new Map(entries.map((entry) => [entry.athleteId, entry]));
}

export async function recordAthleteImageConsentEvent(input: {
  athleteId: string;
  granted: boolean;
  actedByUserId: string;
  source?: string;
  note?: string | null;
  recordedAt?: Date;
}) {
  const doc = await getCurrentLegalDocument("IMAGE_MEDIA_CONSENT");
  if (!doc) {
    throw new Error("IMAGE_MEDIA_CONSENT_DOCUMENT_MISSING");
  }

  const recordedAt = input.recordedAt ?? new Date();
  const event = await prisma.athleteImageConsentEvent.create({
    data: {
      athleteId: input.athleteId,
      granted: input.granted,
      documentVersion: doc.version,
      documentContentSha256: doc.contentSha256,
      recordedAt,
      actedByUserId: input.actedByUserId,
      source: input.source ?? null,
      note: input.note ?? null,
    },
    select: { id: true, granted: true, recordedAt: true },
  });

  if (!input.granted) {
    await prisma.mediaItem.updateMany({
      where: {
        subjects: { some: { athleteId: input.athleteId } },
        reviewStatus: { in: ["READY", "NEEDS_REVIEW"] },
      },
      data: { reviewStatus: "BLOCKED_CONSENT" },
    });
  }

  return event;
}
