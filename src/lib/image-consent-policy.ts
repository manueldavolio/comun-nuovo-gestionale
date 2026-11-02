import type { MediaReviewStatus } from "@prisma/client";

export type AthleteImageConsentState = {
  athleteId: string;
  granted: boolean;
  source: "event" | "enrollment" | "none";
  recordedAt: Date | null;
  documentVersion: string | null;
};

export function computeMediaReviewStatus(input: {
  subjectAthleteIds: string[];
  subjectsDeclaredComplete: boolean;
  consentByAthleteId: Map<string, AthleteImageConsentState>;
}): MediaReviewStatus {
  if (!input.subjectsDeclaredComplete || input.subjectAthleteIds.length === 0) {
    return "NEEDS_REVIEW";
  }

  for (const athleteId of input.subjectAthleteIds) {
    const state = input.consentByAthleteId.get(athleteId);
    if (!state?.granted) {
      return "BLOCKED_CONSENT";
    }
  }

  return "READY";
}

/** Solo media READY e pubblicati sono visibili ai genitori. */
export function parentVisibleMediaWhere() {
  return {
    reviewStatus: "READY" as const,
    publishedAt: { not: null, lte: new Date() },
    subjectsDeclaredComplete: true,
  };
}
