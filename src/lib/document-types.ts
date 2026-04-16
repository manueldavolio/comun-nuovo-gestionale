import type { DocumentType } from "@/generated/prisma/enums";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  ID_CARD: "Carta d'identita",
  TAX_CODE: "Codice fiscale",
  MEDICAL_CERTIFICATE: "Certificato medico",
  PRIVACY_FORM: "Consenso privacy",
  IMAGE_CONSENT: "Consenso immagini",
  OTHER: "Altro",
};

export const DOCUMENT_TYPE_CHOICES: { value: DocumentType; label: string }[] = [
  { value: "ID_CARD", label: DOCUMENT_TYPE_LABEL.ID_CARD },
  { value: "TAX_CODE", label: DOCUMENT_TYPE_LABEL.TAX_CODE },
  { value: "MEDICAL_CERTIFICATE", label: DOCUMENT_TYPE_LABEL.MEDICAL_CERTIFICATE },
  { value: "PRIVACY_FORM", label: DOCUMENT_TYPE_LABEL.PRIVACY_FORM },
  { value: "IMAGE_CONSENT", label: DOCUMENT_TYPE_LABEL.IMAGE_CONSENT },
  { value: "OTHER", label: DOCUMENT_TYPE_LABEL.OTHER },
];

