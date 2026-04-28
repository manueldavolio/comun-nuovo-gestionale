import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  MEDICAL_VISIT_CERTIFICATE_MAX_BYTES,
  MedicalVisitCertificateStorageError,
  isAllowedMedicalVisitCertificateMime,
  saveMedicalVisitCertificate,
  validateMedicalVisitCertificateStorageEnv,
} from "@/lib/medical-visit-certificates";

export const runtime = "nodejs";

const GENERIC_UPLOAD_ERROR = "Caricamento certificato non riuscito.";

type UploadErrorPayload = {
  error: string;
  errorCode?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
};

function jsonError(payload: UploadErrorPayload, status: number) {
  return NextResponse.json(payload, { status });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return jsonError({ error: "Sessione non valida.", errorCode: "AUTH_INVALID_SESSION" }, 401);
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    return jsonError({ error: "Operazione non consentita.", errorCode: "AUTH_FORBIDDEN_ROLE" }, 403);
  }

  try {
    const storageConfig = validateMedicalVisitCertificateStorageEnv();
    console.info("[medical-visits][upload-certificate] env check", {
      ok: true,
      bucket: storageConfig.bucket,
      envChecked: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_MEDICAL_VISITS_BUCKET"],
    });
  } catch (error) {
    if (error instanceof MedicalVisitCertificateStorageError) {
      console.error("[medical-visits][upload-certificate] env check", {
        ok: false,
        code: error.details.code,
        missingEnv: error.details.missingEnv,
        bucket: error.details.bucket,
      });
      if (error.details.code === "SUPABASE_STORAGE_ENV_MISSING" && error.details.missingEnv) {
        return jsonError(
          {
            error: `Configurazione mancante: ${error.details.missingEnv}.`,
            errorCode: "UPLOAD_STORAGE_ENV_MISSING",
            details: { missingEnv: error.details.missingEnv },
          },
          500,
        );
      }
      if (error.details.code === "SUPABASE_STORAGE_BUCKET_INVALID") {
        return jsonError(
          {
            error: "Bucket Supabase non valido. Usare medical-visit-certificates.",
            errorCode: "UPLOAD_STORAGE_BUCKET_INVALID",
            details: {
              expectedBucket: "medical-visit-certificates",
              receivedBucket: error.details.bucket,
            },
          },
          500,
        );
      }
    }
    return jsonError({ error: GENERIC_UPLOAD_ERROR, errorCode: "UPLOAD_INTERNAL_ERROR" }, 500);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("[medical-visits][upload-certificate] Invalid multipart/form-data payload", {
      error,
      userId: session.user.id,
      runtime: process.env.VERCEL ? "vercel" : "node",
    });
    return jsonError({ error: "Richiesta upload non valida.", errorCode: "UPLOAD_INVALID_FORM_DATA" }, 400);
  }

  const file = formData.get("certificate");
  if (!(file instanceof File)) {
    return jsonError({ error: "Seleziona un file certificato.", errorCode: "UPLOAD_FILE_MISSING" }, 400);
  }

  if (!isAllowedMedicalVisitCertificateMime(file.type)) {
    return jsonError(
      {
        error: "Formato non valido. Sono ammessi PDF, JPG, PNG.",
        errorCode: "UPLOAD_UNSUPPORTED_MIME_TYPE",
        details: { mimeType: file.type || "unknown" },
      },
      400,
    );
  }

  if (file.size > MEDICAL_VISIT_CERTIFICATE_MAX_BYTES) {
    return jsonError(
      {
        error: "Il file supera la dimensione massima di 10 MB.",
        errorCode: "UPLOAD_FILE_TOO_LARGE",
        details: { maxBytes: MEDICAL_VISIT_CERTIFICATE_MAX_BYTES, receivedBytes: file.size },
      },
      400,
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const storedPath = await saveMedicalVisitCertificate({
      fileBuffer: Buffer.from(arrayBuffer),
      mimeType: file.type,
      originalName: file.name,
    });

    return NextResponse.json({ success: true, data: { storedPath, originalName: file.name } }, { status: 201 });
  } catch (error) {
    if (error instanceof MedicalVisitCertificateStorageError) {
      const isMissingEnv = error.details.code === "SUPABASE_STORAGE_ENV_MISSING";
      console.error("[medical-visits][upload-certificate] Storage write failure", {
        errorName: error.name,
        errorMessage: error.message,
        stage: error.details.stage,
        code: error.details.code,
        missingEnv: error.details.missingEnv,
        storageDir: error.details.storageDir,
        absolutePath: error.details.absolutePath,
        originalMessage: error.details.originalMessage,
        userId: session.user.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        runtime: process.env.VERCEL ? "vercel" : "node",
      });
      return jsonError(
        {
          error: isMissingEnv
            ? `Configurazione mancante: ${error.details.missingEnv ?? "SUPABASE_URL"}.`
            : "Errore durante il salvataggio del certificato su Supabase Storage.",
          errorCode: isMissingEnv ? "UPLOAD_STORAGE_ENV_MISSING" : "UPLOAD_STORAGE_WRITE_FAILED",
          details: {
            stage: error.details.stage,
            code: error.details.code,
            missingEnv: error.details.missingEnv,
            storageDir: error.details.storageDir,
            bucket: error.details.bucket,
            bucketPath: error.details.bucketPath,
          },
        },
        500,
      );
    }

    console.error("[medical-visits][upload-certificate] Unexpected upload error", {
      error,
      userId: session.user.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      runtime: process.env.VERCEL ? "vercel" : "node",
    });
    return jsonError({ error: GENERIC_UPLOAD_ERROR, errorCode: "UPLOAD_INTERNAL_ERROR" }, 500);
  }
}
