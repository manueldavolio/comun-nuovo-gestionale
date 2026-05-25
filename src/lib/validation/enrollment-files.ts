import type { EnrollmentDocumentType } from "@prisma/client";
import {
  assertOwnedPendingEnrollmentDocumentPath,
  EnrollmentDocumentStorageError,
  inferEnrollmentDocumentMime,
  isAllowedEnrollmentDocumentMime,
} from "@/lib/enrollment-documents";
import {
  ENROLLMENT_DOCUMENT_FORM_FIELD,
  ENROLLMENT_DOCUMENT_TYPE_LABEL,
  ENROLLMENT_DOCUMENT_TYPES_ORDER,
} from "@/lib/enrollment-document-types";

export type EnrollmentDocumentReference = {
  type: EnrollmentDocumentType;
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type EnrollmentDocumentReferencesPayload = Partial<
  Record<(typeof ENROLLMENT_DOCUMENT_FORM_FIELD)[EnrollmentDocumentType], string>
>;

export function parseEnrollmentDocumentReferences(
  payload: unknown,
): EnrollmentDocumentReferencesPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const result: EnrollmentDocumentReferencesPayload = {};

  for (const type of ENROLLMENT_DOCUMENT_TYPES_ORDER) {
    const fieldName = ENROLLMENT_DOCUMENT_FORM_FIELD[type];
    const value = source[fieldName];
    if (typeof value === "string" && value.trim()) {
      result[fieldName] = value.trim();
    }
  }

  return result;
}

export function validateEnrollmentDocumentReferences(
  payload: EnrollmentDocumentReferencesPayload | null,
  userId: string,
): { ok: true; documents: EnrollmentDocumentReference[] } | { ok: false; error: string } {
  if (!payload) {
    return { ok: false, error: "Documenti iscrizione mancanti." };
  }

  const documents: EnrollmentDocumentReference[] = [];

  for (const type of ENROLLMENT_DOCUMENT_TYPES_ORDER) {
    const fieldName = ENROLLMENT_DOCUMENT_FORM_FIELD[type];
    const storedPath = payload[fieldName];
    const label = ENROLLMENT_DOCUMENT_TYPE_LABEL[type];

    if (!storedPath) {
      return { ok: false, error: `${label}: documento mancante.` };
    }

    try {
      const filePath = assertOwnedPendingEnrollmentDocumentPath(storedPath, userId);
      const fileName = filePath.split("/").pop() ?? "document";
      const mimeType = inferEnrollmentDocumentMime(fileName, "");
      if (!isAllowedEnrollmentDocumentMime(mimeType)) {
        return {
          ok: false,
          error: `${label}: formato non valido. Usa PDF, JPG, JPEG o PNG.`,
        };
      }

      documents.push({
        type,
        filePath,
        fileName,
        mimeType,
        size: 0,
      });
    } catch (error) {
      if (error instanceof EnrollmentDocumentStorageError) {
        return { ok: false, error: `${label}: percorso documento non valido.` };
      }
      return { ok: false, error: `${label}: documento non valido.` };
    }
  }

  return { ok: true, documents };
}

export function applyUploadedEnrollmentDocumentMetadata(
  documents: EnrollmentDocumentReference[],
  uploads: Array<{
    documentType: EnrollmentDocumentType;
    storedPath: string;
    fileName: string;
    mimeType: string;
    size: number;
  }>,
): EnrollmentDocumentReference[] {
  const byType = new Map(uploads.map((item) => [item.documentType, item]));

  return documents.map((document) => {
    const upload = byType.get(document.type);
    if (!upload || upload.storedPath !== document.filePath) {
      return document;
    }

    return {
      ...document,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      size: upload.size,
    };
  });
}
