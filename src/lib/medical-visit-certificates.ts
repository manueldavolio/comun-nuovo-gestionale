import path from "node:path";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const MEDICAL_VISIT_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

const STORAGE_DIR = path.join(process.cwd(), "storage", "medical-visits");
const MEDICAL_VISITS_BUCKET_NAME = "medical-visit-certificates";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

const MIME_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

type NodeErrorWithCode = Error & { code?: string };
type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export class MedicalVisitCertificateStorageError extends Error {
  constructor(
    message: string,
    public readonly details: {
      stage: "env" | "upload" | "download" | "legacy-read";
      storageDir: string;
      bucket?: string;
      bucketPath?: string;
      absolutePath?: string;
      code?: string;
      originalMessage?: string;
      missingEnv?: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "SUPABASE_MEDICAL_VISITS_BUCKET";
    },
  ) {
    super(message);
    this.name = "MedicalVisitCertificateStorageError";
  }
}

function getSafeBasename(filePath: string): string {
  return path.basename(filePath.replaceAll("\\", "/"));
}

function getStorageEnv() {
  return {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_MEDICAL_VISITS_BUCKET,
  };
}

export function validateMedicalVisitCertificateStorageEnv(): SupabaseStorageConfig {
  const env = getStorageEnv();
  const missingEnv =
    !env.url
      ? "SUPABASE_URL"
      : !env.serviceRoleKey
        ? "SUPABASE_SERVICE_ROLE_KEY"
        : !env.bucket
          ? "SUPABASE_MEDICAL_VISITS_BUCKET"
          : null;

  if (missingEnv) {
    throw new MedicalVisitCertificateStorageError(
      `Configurazione Supabase Storage mancante: ${missingEnv}.`,
      {
        stage: "env",
        storageDir: STORAGE_DIR,
        bucket: env.bucket,
        code: "SUPABASE_STORAGE_ENV_MISSING",
        missingEnv,
      },
    );
  }

  if (env.bucket !== MEDICAL_VISITS_BUCKET_NAME) {
    throw new MedicalVisitCertificateStorageError(
      `Bucket Supabase non valido: usare ${MEDICAL_VISITS_BUCKET_NAME}.`,
      {
        stage: "env",
        storageDir: STORAGE_DIR,
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

function hasConfiguredSupabaseStorage() {
  const env = getStorageEnv();
  return Boolean(env.url && env.serviceRoleKey && env.bucket);
}

function getSupabaseStorageConfigOrThrow(): SupabaseStorageConfig {
  const config = validateMedicalVisitCertificateStorageEnv();
  const rawUrl = process.env.SUPABASE_URL;
  const supabaseUrlOrigin = new URL(rawUrl ?? config.url).origin;

  console.info("[medical-visits][supabase-storage-config] using supabase origin", {
    supabaseUrlOrigin,
  });

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

function normalizeCertificateFileName(originalName: string | undefined, fallbackExtension: string): string {
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

  const safeBase = normalizedBase || "certificate";
  const safeExtension = normalizedExtension || fallbackExtension || ".bin";
  return `${safeBase}${safeExtension}`;
}

export function isAllowedMedicalVisitCertificateMime(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function getMedicalVisitCertificateDownloadName(filePath: string): string {
  return getSafeBasename(normalizeBucketPath(filePath));
}

export async function saveMedicalVisitCertificate(params: {
  fileBuffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<string> {
  const mimeType = params.mimeType.toLowerCase();
  if (!isAllowedMedicalVisitCertificateMime(mimeType)) {
    throw new Error("Formato file non supportato.");
  }

  const extension = MIME_EXTENSION[mimeType] ?? ".bin";
  const safeFileName = normalizeCertificateFileName(params.originalName, extension);
  const finalPath = `medical-visits/${Date.now()}-${safeFileName}`;
  const { client, bucket } = getSupabaseStorageClient();
  const fileSize = params.fileBuffer.byteLength;
  console.info("[medical-visits][upload-certificate] final path", {
    bucket,
    finalPath,
  });
  console.log("[medical-visits][upload-certificate] supabase upload start", {
    bucket,
    path: finalPath,
    fileName: safeFileName,
    fileSize,
    mimeType,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    bucketEnv: process.env.SUPABASE_MEDICAL_VISITS_BUCKET,
  });

  try {
    const { data, error } = await client.storage.from(bucket).upload(finalPath, params.fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) {
      const uploadError = error as Error & { statusCode?: string | number };
      console.error("[medical-visits][upload-certificate] supabase upload error", {
        bucket,
        path: finalPath,
        fileName: safeFileName,
        fileSize,
        mimeType,
        errorMessage: uploadError.message,
        errorName: uploadError.name,
        errorStatusCode: uploadError.statusCode,
        error: uploadError,
      });
      throw error;
    }
    console.log("[medical-visits][upload-certificate] supabase upload success", {
      bucket,
      path: finalPath,
      fileName: safeFileName,
      fileSize,
      mimeType,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      bucketEnv: process.env.SUPABASE_MEDICAL_VISITS_BUCKET,
      hasData: Boolean(data),
    });
  } catch (error) {
    const storageError = error as Error & { code?: string };
    throw new MedicalVisitCertificateStorageError("Impossibile salvare il certificato su Supabase Storage.", {
      stage: "upload",
      storageDir: STORAGE_DIR,
      bucket,
      bucketPath: finalPath,
      code: storageError.code,
      originalMessage: storageError.message,
    });
  }

  console.info("[medical-visits][upload-certificate] supabase upload success", {
    bucket,
    bucketPath: finalPath,
  });
  return finalPath;
}

export async function readMedicalVisitCertificate(filePath: string): Promise<Buffer> {
  const bucketPath = normalizeBucketPath(filePath);
  if (hasConfiguredSupabaseStorage()) {
    const { client, bucket } = getSupabaseStorageClient();
    const { data, error } = await client.storage.from(bucket).download(bucketPath);
    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    if (error && error.message?.toLowerCase().includes("not found")) {
      // legacy fallback for historical local paths
      return readLegacyLocalMedicalVisitCertificate(filePath);
    }

    if (error) {
      throw new MedicalVisitCertificateStorageError("Errore durante il download da Supabase Storage.", {
        stage: "download",
        storageDir: STORAGE_DIR,
        bucket,
        bucketPath,
        code: (error as NodeErrorWithCode).code,
        originalMessage: error.message,
      });
    }
  }

  return readLegacyLocalMedicalVisitCertificate(filePath);
}

async function readLegacyLocalMedicalVisitCertificate(filePath: string): Promise<Buffer> {
  const safeBasename = getSafeBasename(filePath);
  const absolutePath = path.join(STORAGE_DIR, safeBasename);
  try {
    return await readFile(absolutePath);
  } catch (error) {
    const nodeError = error as NodeErrorWithCode;
    if (nodeError.code === "ENOENT" && !hasConfiguredSupabaseStorage()) {
      throw new MedicalVisitCertificateStorageError(
        "Certificato non disponibile: storage Supabase non configurato e file legacy locale assente.",
        {
          stage: "env",
          storageDir: STORAGE_DIR,
          absolutePath,
          code: "SUPABASE_STORAGE_ENV_MISSING",
          originalMessage: nodeError.message,
        },
      );
    }
    if (nodeError.code === "ENOENT") {
      throw new MedicalVisitCertificateStorageError("Certificato non trovato su storage.", {
        stage: "legacy-read",
        storageDir: STORAGE_DIR,
        absolutePath,
        code: "CERTIFICATE_NOT_FOUND",
        originalMessage: nodeError.message,
      });
    }
    throw new MedicalVisitCertificateStorageError("Impossibile leggere il certificato locale legacy.", {
      stage: "legacy-read",
      storageDir: STORAGE_DIR,
      absolutePath,
      code: nodeError.code,
      originalMessage: nodeError.message,
    });
  }
}
