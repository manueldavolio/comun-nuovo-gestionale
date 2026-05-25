import { NextResponse } from "next/server";
import type { EnrollmentDocumentType } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import {
  ENROLLMENT_DOCUMENT_MAX_BYTES,
  EnrollmentDocumentStorageError,
  inferEnrollmentDocumentMime,
  isAllowedEnrollmentDocumentMime,
  savePendingEnrollmentDocument,
  validateEnrollmentDocumentStorageEnv,
} from "@/lib/enrollment-documents";
import { ENROLLMENT_DOCUMENT_FIELD_TYPE, ENROLLMENT_DOCUMENT_TYPE_LABEL } from "@/lib/enrollment-document-types";

export const runtime = "nodejs";

const GENERIC_UPLOAD_ERROR = "Caricamento documento non riuscito.";

type UploadErrorPayload = {
  error: string;
  errorCode?: string;
};

function jsonError(payload: UploadErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return jsonError({ error: "Sessione non valida.", errorCode: "AUTH_INVALID_SESSION" }, 401);
  }

  if (session.user.role !== "PARENT") {
    return jsonError({ error: "Operazione non consentita.", errorCode: "AUTH_FORBIDDEN_ROLE" }, 403);
  }

  try {
    validateEnrollmentDocumentStorageEnv();
  } catch (error) {
    if (error instanceof EnrollmentDocumentStorageError) {
      if (error.details.code === "SUPABASE_STORAGE_ENV_MISSING" && error.details.missingEnv) {
        return jsonError(
          {
            error: `Configurazione storage mancante: ${error.details.missingEnv}. Contatta la segreteria.`,
            errorCode: "UPLOAD_STORAGE_ENV_MISSING",
          },
          500,
        );
      }
      return jsonError(
        {
          error: "Configurazione storage documenti non disponibile. Contatta la segreteria.",
          errorCode: "UPLOAD_STORAGE_CONFIG_INVALID",
        },
        500,
      );
    }
    return jsonError({ error: GENERIC_UPLOAD_ERROR, errorCode: "UPLOAD_INTERNAL_ERROR" }, 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError({ error: "Richiesta upload non valida.", errorCode: "UPLOAD_INVALID_FORM_DATA" }, 400);
  }

  const documentTypeRaw = formData.get("documentType");
  if (typeof documentTypeRaw !== "string" || !documentTypeRaw.trim()) {
    return jsonError({ error: "Tipo documento mancante.", errorCode: "UPLOAD_DOCUMENT_TYPE_MISSING" }, 400);
  }

  const documentType = ENROLLMENT_DOCUMENT_FIELD_TYPE[documentTypeRaw.trim()] as
    | EnrollmentDocumentType
    | undefined;
  if (!documentType) {
    return jsonError({ error: "Tipo documento non valido.", errorCode: "UPLOAD_DOCUMENT_TYPE_INVALID" }, 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError(
      {
        error: `${ENROLLMENT_DOCUMENT_TYPE_LABEL[documentType]}: seleziona un file.`,
        errorCode: "UPLOAD_FILE_MISSING",
      },
      400,
    );
  }

  const mimeType = inferEnrollmentDocumentMime(file.name, file.type || "");
  if (!isAllowedEnrollmentDocumentMime(mimeType)) {
    return jsonError(
      {
        error: `${ENROLLMENT_DOCUMENT_TYPE_LABEL[documentType]}: formato non valido. Usa PDF, JPG, JPEG o PNG.`,
        errorCode: "UPLOAD_UNSUPPORTED_MIME_TYPE",
      },
      400,
    );
  }

  if (file.size > ENROLLMENT_DOCUMENT_MAX_BYTES) {
    return jsonError(
      {
        error: `${ENROLLMENT_DOCUMENT_TYPE_LABEL[documentType]}: il file supera i 10 MB.`,
        errorCode: "UPLOAD_FILE_TOO_LARGE",
      },
      400,
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const storedPath = await savePendingEnrollmentDocument({
      userId: session.user.id,
      documentType,
      fileBuffer: Buffer.from(arrayBuffer),
      mimeType,
      originalName: file.name,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          storedPath,
          documentType,
          fileName: file.name,
          mimeType,
          size: file.size,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof EnrollmentDocumentStorageError) {
      return jsonError(
        {
          error: `${ENROLLMENT_DOCUMENT_TYPE_LABEL[documentType]}: caricamento non riuscito. Riprova.`,
          errorCode: "UPLOAD_STORAGE_WRITE_FAILED",
        },
        500,
      );
    }

    if (error instanceof Error && error.message.includes("10 MB")) {
      return jsonError(
        {
          error: `${ENROLLMENT_DOCUMENT_TYPE_LABEL[documentType]}: il file supera i 10 MB.`,
          errorCode: "UPLOAD_FILE_TOO_LARGE",
        },
        400,
      );
    }

    return jsonError({ error: GENERIC_UPLOAD_ERROR, errorCode: "UPLOAD_INTERNAL_ERROR" }, 500);
  }
}
