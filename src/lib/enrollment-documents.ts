import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EnrollmentDocumentType } from "@prisma/client";

export const ENROLLMENT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ENROLLMENT_DOCUMENTS_BUCKET_NAME = "enrollment-documents";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const MIME_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
};

type NodeErrorWithCode = Error & { code?: string };
type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export class EnrollmentDocumentStorageError extends Error {
  constructor(
    message: string,
    public readonly details: {
      stage: "env" | "upload" | "download";
      bucket?: string;
      bucketPath?: string;
      code?: string;
      originalMessage?: string;
      missingEnv?: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET";
    },
  ) {
    super(message);
    this.name = "EnrollmentDocumentStorageError";
  }
}

function getSafeBasename(filePath: string): string {
  return path.basename(filePath.replaceAll("\\", "/"));
}

function getStorageEnv() {
  return {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket:
      process.env.SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET ?? ENROLLMENT_DOCUMENTS_BUCKET_NAME,
  };
}

export function validateEnrollmentDocumentStorageEnv(): SupabaseStorageConfig {
  const env = getStorageEnv();
  const missingEnv =
    !env.url
      ? "SUPABASE_URL"
      : !env.serviceRoleKey
        ? "SUPABASE_SERVICE_ROLE_KEY"
        : !env.bucket
          ? "SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET"
          : null;

  if (missingEnv) {
    throw new EnrollmentDocumentStorageError(
      `Configurazione Supabase Storage mancante: ${missingEnv}.`,
      {
        stage: "env",
        bucket: env.bucket,
        code: "SUPABASE_STORAGE_ENV_MISSING",
        missingEnv,
      },
    );
  }

  if (env.bucket !== ENROLLMENT_DOCUMENTS_BUCKET_NAME) {
    throw new EnrollmentDocumentStorageError(
      `Bucket Supabase non valido: usare ${ENROLLMENT_DOCUMENTS_BUCKET_NAME}.`,
      {
        stage: "env",
        bucket: env.bucket,
        code: "SUPABASE_STORAGE_BUCKET_INVALID",
      },
    );
  }

  return {
    url: env.url,
    serviceRoleKey: env.serviceRoleKey,
    bucket: env.bucket,
  } as SupabaseStorageConfig;
}

function getSupabaseStorageConfigOrThrow(): SupabaseStorageConfig {
  const config = validateEnrollmentDocumentStorageEnv();
  const supabaseUrlOrigin = new URL(process.env.SUPABASE_URL ?? config.url).origin;

  return {
    ...config,
    url: supabaseUrlOrigin,
  };
}

function getSupabaseStorageClient(): { client: SupabaseClient; bucket: string } {
  const config = getSupabaseStorageConfigOrThrow();
  return {
    client: createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    bucket: config.bucket,
  };
}

function normalizeBucketPath(filePath: string): string {
  const normalized = filePath.trim().replaceAll("\\", "/").replace(/^\/+/, "");
  if (normalized.startsWith("supabase://")) {
    const withoutScheme = normalized.slice("supabase://".length);
    const firstSlash = withoutScheme.indexOf("/");
    if (firstSlash >= 0) {
      return withoutScheme.slice(firstSlash + 1);
    }
  }
  return normalized;
}

function normalizeDocumentFileName(originalName: string | undefined, fallbackExtension: string): string {
  const rawName = (originalName ?? "").trim().toLowerCase();
  const extFromName = path.extname(rawName);
  const baseName = extFromName ? rawName.slice(0, -extFromName.length) : rawName;
  const normalizedBase = baseName
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  const extensionCandidate = extFromName || fallbackExtension;
  const normalizedExtension = extensionCandidate
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .replace(/^\.+/, ".");

  const safeBase = normalizedBase || "document";
  const safeExtension = normalizedExtension || fallbackExtension || ".bin";
  return `${safeBase}${safeExtension}`;
}

export function inferEnrollmentDocumentMime(fileName: string, mimeType: string): string {
  const normalizedMime = mimeType.toLowerCase();
  if (normalizedMime && isAllowedEnrollmentDocumentMime(normalizedMime)) {
    return normalizedMime === "image/jpg" ? "image/jpeg" : normalizedMime;
  }

  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";

  return normalizedMime;
}

export function isAllowedEnrollmentDocumentMime(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function getEnrollmentDocumentDownloadName(filePath: string, fileName?: string): string {
  return fileName?.trim() || getSafeBasename(normalizeBucketPath(filePath));
}

export async function saveEnrollmentDocument(params: {
  enrollmentId: string;
  documentType: EnrollmentDocumentType;
  fileBuffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<string> {
  const mimeType = params.mimeType.toLowerCase();
  if (!isAllowedEnrollmentDocumentMime(mimeType)) {
    throw new Error("Formato file non supportato.");
  }

  const extension = MIME_EXTENSION[mimeType] ?? ".bin";
  const safeFileName = normalizeDocumentFileName(params.originalName, extension);
  const finalPath = `enrollment-documents/${params.enrollmentId}/${params.documentType.toLowerCase()}-${Date.now()}-${safeFileName}`;
  const { client, bucket } = getSupabaseStorageClient();

  const { error } = await client.storage.from(bucket).upload(finalPath, params.fileBuffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    const storageError = error as Error & { code?: string };
    throw new EnrollmentDocumentStorageError(
      "Impossibile salvare il documento su Supabase Storage.",
      {
        stage: "upload",
        bucket,
        bucketPath: finalPath,
        code: storageError.code,
        originalMessage: storageError.message,
      },
    );
  }

  return finalPath;
}

export async function readEnrollmentDocument(filePath: string): Promise<Buffer> {
  const bucketPath = normalizeBucketPath(filePath);
  const { client, bucket } = getSupabaseStorageClient();
  const { data, error } = await client.storage.from(bucket).download(bucketPath);

  if (!error && data) {
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (error && error.message?.toLowerCase().includes("not found")) {
    throw new EnrollmentDocumentStorageError("Documento non trovato su storage.", {
      stage: "download",
      bucket,
      bucketPath,
      code: "DOCUMENT_NOT_FOUND",
      originalMessage: error.message,
    });
  }

  if (error) {
    throw new EnrollmentDocumentStorageError("Errore durante il download da Supabase Storage.", {
      stage: "download",
      bucket,
      bucketPath,
      code: (error as NodeErrorWithCode).code,
      originalMessage: error.message,
    });
  }

  throw new EnrollmentDocumentStorageError("Documento non trovato su storage.", {
    stage: "download",
    bucket,
    bucketPath,
    code: "DOCUMENT_NOT_FOUND",
  });
}
