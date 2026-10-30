import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SITE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const SITE_IMAGES_BUCKET_NAME = "site-images";

export const SITE_IMAGE_FOLDERS = [
  "players",
  "staff",
  "news",
  "sponsors",
  "gallery",
  "convenzioni",
] as const;

export type SiteImageFolder = (typeof SITE_IMAGE_FOLDERS)[number];

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export class SiteImageStorageError extends Error {
  constructor(
    message: string,
    public readonly details: {
      stage: "env" | "upload";
      bucket?: string;
      bucketPath?: string;
      code?: string;
      originalMessage?: string;
      missingEnv?: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY";
    },
  ) {
    super(message);
    this.name = "SiteImageStorageError";
  }
}

export function isSiteImageFolder(value: string): value is SiteImageFolder {
  return (SITE_IMAGE_FOLDERS as readonly string[]).includes(value);
}

export function isAllowedSiteImageMime(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

function resolveSiteImagesBucketName(): string {
  const configured = (process.env.SUPABASE_SITE_IMAGES_BUCKET ?? "").trim();
  return configured || SITE_IMAGES_BUCKET_NAME;
}

export function validateSiteImageStorageEnv(): SupabaseStorageConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = resolveSiteImagesBucketName();

  const missingEnv = !url ? "SUPABASE_URL" : !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null;
  if (missingEnv) {
    throw new SiteImageStorageError(`Configurazione Supabase Storage mancante: ${missingEnv}.`, {
      stage: "env",
      bucket,
      code: "SUPABASE_STORAGE_ENV_MISSING",
      missingEnv,
    });
  }

  return {
    url: new URL(url as string).origin,
    serviceRoleKey: serviceRoleKey as string,
    bucket,
  };
}

/**
 * Assicura che il bucket immagini esista ed sia pubblico (idempotente).
 * Necessario per Social Studio / CMS quando il bucket non è ancora stato creato.
 */
export async function ensureSiteImagesBucket(): Promise<{ bucket: string; created: boolean }> {
  const { client, bucket } = getSupabaseStorageClient();
  const listed = await client.storage.listBuckets();
  if (listed.error) {
    throw new SiteImageStorageError(
      `Impossibile verificare i bucket Storage (${listed.error.message}).`,
      {
        stage: "upload",
        bucket,
        code: "SUPABASE_LIST_BUCKETS_FAILED",
        originalMessage: listed.error.message,
      },
    );
  }
  const existing = (listed.data ?? []).find((row) => row.name === bucket);
  if (existing) {
    if (!existing.public) {
      const updated = await client.storage.updateBucket(bucket, {
        public: true,
        fileSizeLimit: SITE_IMAGE_MAX_BYTES,
        allowedMimeTypes: [...ALLOWED_MIME_TYPES],
      });
      if (updated.error) {
        throw new SiteImageStorageError(
          `Il bucket "${bucket}" esiste ma non è pubblico e non è stato possibile aggiornarlo: ${updated.error.message}`,
          {
            stage: "upload",
            bucket,
            code: "SUPABASE_BUCKET_NOT_PUBLIC",
            originalMessage: updated.error.message,
          },
        );
      }
    }
    return { bucket, created: false };
  }

  const created = await client.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: SITE_IMAGE_MAX_BYTES,
    allowedMimeTypes: [...ALLOWED_MIME_TYPES],
  });
  if (created.error) {
    // Race: un altro processo può aver creato il bucket nel frattempo.
    const again = await client.storage.listBuckets();
    if ((again.data ?? []).some((row) => row.name === bucket)) {
      return { bucket, created: false };
    }
    throw new SiteImageStorageError(
      `Bucket Storage "${bucket}" assente e non creabile: ${created.error.message}`,
      {
        stage: "upload",
        bucket,
        code: "SUPABASE_BUCKET_CREATE_FAILED",
        originalMessage: created.error.message,
      },
    );
  }
  return { bucket, created: true };
}

function getSupabaseStorageClient(): { client: SupabaseClient; bucket: string } {
  const config = validateSiteImageStorageEnv();
  return {
    client: createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    bucket: config.bucket,
  };
}

function normalizeImageFileName(originalName: string | undefined, fallbackExtension: string): string {
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

  const safeBase = normalizedBase || "image";
  const safeExtension = normalizedExtension || fallbackExtension || ".bin";
  return `${safeBase}${safeExtension}`;
}

export async function saveSiteImage(params: {
  folder: SiteImageFolder;
  fileBuffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<{ path: string; publicUrl: string }> {
  const mimeType = params.mimeType.toLowerCase();
  if (!isAllowedSiteImageMime(mimeType)) {
    throw new Error("Formato immagine non supportato. Usa JPG, PNG, WEBP o SVG.");
  }

  if (params.fileBuffer.length > SITE_IMAGE_MAX_BYTES) {
    throw new Error("L'immagine supera la dimensione massima di 8 MB.");
  }

  const extension = MIME_EXTENSION[mimeType] ?? ".bin";
  const safeFileName = normalizeImageFileName(params.originalName, extension);
  const finalPath = `${params.folder}/${Date.now()}-${safeFileName}`;
  await ensureSiteImagesBucket();
  const { client, bucket } = getSupabaseStorageClient();

  const { error } = await client.storage.from(bucket).upload(finalPath, params.fileBuffer, {
    contentType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
    upsert: false,
  });

  if (error) {
    const storageError = error as Error & { code?: string; statusCode?: string };
    const notFound =
      /bucket not found/i.test(storageError.message) || storageError.statusCode === "404";
    throw new SiteImageStorageError(
      notFound
        ? `Bucket Storage "${bucket}" non trovato su Supabase. Verifica SUPABASE_SITE_IMAGES_BUCKET.`
        : `Impossibile salvare l'immagine su Supabase Storage (${storageError.message}).`,
      {
        stage: "upload",
        bucket,
        bucketPath: finalPath,
        code: storageError.code ?? (notFound ? "SUPABASE_BUCKET_NOT_FOUND" : undefined),
        originalMessage: storageError.message,
      },
    );
  }

  const { data } = client.storage.from(bucket).getPublicUrl(finalPath);
  return { path: finalPath, publicUrl: data.publicUrl };
}
