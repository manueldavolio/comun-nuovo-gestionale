import type { EnrollmentDocumentType } from "@prisma/client";

export const ENROLLMENT_DOCUMENT_TYPE_LABEL: Record<EnrollmentDocumentType, string> = {
  PARENT_ID_FRONT: "Documento genitore fronte",
  PARENT_ID_BACK: "Documento genitore retro",
  ATHLETE_ID_FRONT: "Documento atleta fronte",
  ATHLETE_ID_BACK: "Documento atleta retro",
  ATHLETE_PORTRAIT: "Foto primo piano atleta",
};

export const ENROLLMENT_DOCUMENT_TYPES_ORDER: EnrollmentDocumentType[] = [
  "PARENT_ID_FRONT",
  "PARENT_ID_BACK",
  "ATHLETE_ID_FRONT",
  "ATHLETE_ID_BACK",
  "ATHLETE_PORTRAIT",
];

export const ENROLLMENT_DOCUMENT_FORM_FIELD: Record<EnrollmentDocumentType, string> = {
  PARENT_ID_FRONT: "parentIdFront",
  PARENT_ID_BACK: "parentIdBack",
  ATHLETE_ID_FRONT: "athleteIdFront",
  ATHLETE_ID_BACK: "athleteIdBack",
  ATHLETE_PORTRAIT: "athletePortrait",
};

export const ENROLLMENT_DOCUMENT_FIELD_TYPE: Record<string, EnrollmentDocumentType> = {
  parentIdFront: "PARENT_ID_FRONT",
  parentIdBack: "PARENT_ID_BACK",
  athleteIdFront: "ATHLETE_ID_FRONT",
  athleteIdBack: "ATHLETE_ID_BACK",
  athletePortrait: "ATHLETE_PORTRAIT",
};
