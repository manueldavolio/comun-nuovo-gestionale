import type { ImageConsentChoice, ImageConsentPurpose, MediaReviewStatus } from "@prisma/client";

export type AthleteImageConsentState = {
  athleteId: string;
  /** true solo con scelta GRANTED valida per la finalità richiesta (mai legacy 1.0 per EXTERNAL). */
  granted: boolean;
  choice: ImageConsentChoice | null;
  purpose: ImageConsentPurpose | null;
  source: "event" | "enrollment" | "none" | "legacy";
  recordedAt: Date | null;
  documentVersion: string | null;
  /** Consenso monolitico 1.0 presente ma non convertito / non abilitante nuove pubblicazioni. */
  legacyHistoricalOnly: boolean;
};

export function choiceImpliesGrant(choice: ImageConsentChoice | null | undefined): boolean {
  return choice === "GRANTED";
}

/** Pubblicazione esterna (sito/social/cartaceo / galleria genitori READY): solo EXTERNAL 1.1 GRANTED. */
export function allowsExternalPublication(state: AthleteImageConsentState | undefined): boolean {
  if (!state) return false;
  if (state.legacyHistoricalOnly) return false;
  if (state.purpose !== "EXTERNAL") return false;
  return state.choice === "GRANTED" && state.granted;
}

/** Uso interno riservato: solo INTERNAL 1.1 GRANTED (indipendente da EXTERNAL). */
export function allowsInternalUse(state: AthleteImageConsentState | undefined): boolean {
  if (!state) return false;
  if (state.legacyHistoricalOnly) return false;
  if (state.purpose !== "INTERNAL") return false;
  return state.choice === "GRANTED" && state.granted;
}

/**
 * Gate pubblicazione media con soggetti dichiarati.
 * Regola gruppo: ogni soggetto identificabile deve avere EXTERNAL valido;
 * nessuna autorizzazione automatica da “foto di squadra”.
 */
export function computeMediaReviewStatus(input: {
  subjectAthleteIds: string[];
  subjectsDeclaredComplete: boolean;
  /** Mappa già risolta per finalità EXTERNAL. */
  consentByAthleteId: Map<string, AthleteImageConsentState>;
}): MediaReviewStatus {
  if (!input.subjectsDeclaredComplete || input.subjectAthleteIds.length === 0) {
    return "NEEDS_REVIEW";
  }

  for (const athleteId of input.subjectAthleteIds) {
    const state = input.consentByAthleteId.get(athleteId);
    if (!allowsExternalPublication(state)) {
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

export function suspensionWarningForChoiceChange(input: {
  previousChoice: ImageConsentChoice | null;
  nextChoice: ImageConsentChoice;
}): string | null {
  const previousGranted = input.previousChoice === "GRANTED";
  if (!previousGranted) return null;
  if (input.nextChoice === "GRANTED") return null;
  if (input.nextChoice === "DEFERRED") {
    return "Hai scelto DECIDERÒ PIÙ AVANTI: non costituisce consenso. I nuovi utilizzi per questa finalità saranno sospesi.";
  }
  return "Autorizzazione revocata: i nuovi utilizzi per questa finalità saranno sospesi.";
}
