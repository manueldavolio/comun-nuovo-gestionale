/**
 * Policy di retention (documentazione operativa — nessuna cancellazione automatica).
 * Da applicare solo con approvazione esplicita e job dedicati.
 */
export const RETENTION_POLICY = {
  enrollmentPendingDocuments: {
    pathPrefix: "pending/",
    suggestedReviewAfterDays: 30,
    autoDelete: false as const,
    notes:
      "File di documenti iscrizione non finalizzati. Contare e revisionare; non eliminare automaticamente.",
  },
  medicalCertificates: {
    bucket: "medical-visit-certificates",
    autoDelete: false as const,
    notes: "Dati sanitari: conservazione secondo obblighi sportivi/assicurativi; niente purge automatico.",
  },
  enrollmentIdentityDocuments: {
    bucket: "enrollment-documents",
    autoDelete: false as const,
    notes: "Documenti di identità minori/genitori: accesso solo via API autenticata; niente URL pubblici.",
  },
  legacyLocalMedicalStorage: {
    path: "storage/medical-visits",
    autoDelete: false as const,
    notes: "Fallback locale legacy: migrare su bucket privato e rimuovere solo dopo verifica.",
  },
} as const;
