import type { EnrollmentDocumentType } from "@prisma/client";
import {
  ENROLLMENT_DOCUMENT_MAX_BYTES,
  inferEnrollmentDocumentMime,
  isAllowedEnrollmentDocumentMime,
} from "@/lib/enrollment-documents";
import {
  ENROLLMENT_DOCUMENT_FIELD_TYPE,
  ENROLLMENT_DOCUMENT_TYPE_LABEL,
  ENROLLMENT_DOCUMENT_TYPES_ORDER,
} from "@/lib/enrollment-document-types";

export type ParsedEnrollmentFile = {
  type: EnrollmentDocumentType;
  file: File;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  size: number;
};

export function validateEnrollmentFilesFromFormData(
  formData: FormData,
): { ok: true; files: ParsedEnrollmentFile[] } | { ok: false; error: string } {
  const parsedFiles: ParsedEnrollmentFile[] = [];

  for (const type of ENROLLMENT_DOCUMENT_TYPES_ORDER) {
    const fieldName = Object.entries(ENROLLMENT_DOCUMENT_FIELD_TYPE).find(([, value]) => value === type)?.[0];
    if (!fieldName) {
      continue;
    }

    const entry = formData.get(fieldName);
    if (!(entry instanceof File) || entry.size === 0) {
      return {
        ok: false,
        error: `${ENROLLMENT_DOCUMENT_TYPE_LABEL[type]}: seleziona un file.`,
      };
    }

    const mimeType = inferEnrollmentDocumentMime(entry.name, entry.type || "");
    if (!isAllowedEnrollmentDocumentMime(mimeType)) {
      return {
        ok: false,
        error: `${ENROLLMENT_DOCUMENT_TYPE_LABEL[type]}: formato non valido. Usa PDF, JPG, JPEG o PNG.`,
      };
    }

    if (entry.size > ENROLLMENT_DOCUMENT_MAX_BYTES) {
      return {
        ok: false,
        error: `${ENROLLMENT_DOCUMENT_TYPE_LABEL[type]}: il file supera i 10 MB.`,
      };
    }

    parsedFiles.push({
      type,
      file: entry,
      buffer: Buffer.from([]),
      mimeType,
      fileName: entry.name,
      size: entry.size,
    });
  }

  return { ok: true, files: parsedFiles };
}

export async function readEnrollmentFilesBuffers(
  files: ParsedEnrollmentFile[],
): Promise<ParsedEnrollmentFile[]> {
  return Promise.all(
    files.map(async (item) => ({
      ...item,
      buffer: Buffer.from(await item.file.arrayBuffer()),
    })),
  );
}
