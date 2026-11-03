/**
 * Policy pura: download documenti identità iscrizione (EnrollmentDocument).
 * Default GDPR FASE 2: solo ADMIN in area staff. Genitori usano route dedicate.
 */

export type EnrollmentIdentityDownloadDecision =
  | { allow: true }
  | { allow: false; status: 401 | 403; error: string };

/** Download staff dei documenti d'identità iscrizione: solo ADMIN. */
export function decideStaffEnrollmentIdentityDocumentDownload(input: {
  authenticated: boolean;
  role: string | null | undefined;
}): EnrollmentIdentityDownloadDecision {
  if (!input.authenticated) {
    return { allow: false, status: 401, error: "Sessione non valida." };
  }
  if (input.role !== "ADMIN") {
    return {
      allow: false,
      status: 403,
      error: "Download documenti di identità riservato agli amministratori.",
    };
  }
  return { allow: true };
}

/** UI: mostra link download solo ad ADMIN. */
export function canStaffDownloadEnrollmentIdentityDocuments(
  role: string | null | undefined,
): boolean {
  return role === "ADMIN";
}
