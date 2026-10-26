import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SITE_IMAGE_MAX_BYTES,
  SITE_IMAGES_BUCKET_NAME,
  SiteImageStorageError,
  ensureSiteImagesBucket,
  isAllowedSiteImageMime,
  validateSiteImageStorageEnv,
} from "@/lib/site-storage";

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

function getClient(): { client: SupabaseClient; bucket: string } {
  const config = validateSiteImageStorageEnv();
  return {
    client: createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    bucket: config.bucket || SITE_IMAGES_BUCKET_NAME,
  };
}

function normalizeFileName(originalName: string | undefined, fallbackExtension: string): string {
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
  return `${normalizedBase || "asset"}${normalizedExtension || fallbackExtension}`;
}

export function describeSocialStudioUploadError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof SiteImageStorageError) {
    if (error.details.code === "SUPABASE_STORAGE_ENV_MISSING") {
      return {
        status: 500,
        message: `Configurazione Storage mancante: ${error.details.missingEnv ?? "variabile Supabase"}.`,
      };
    }
    if (
      error.details.code === "SUPABASE_BUCKET_NOT_FOUND" ||
      error.details.code === "SUPABASE_BUCKET_CREATE_FAILED" ||
      /bucket .* non trovato|bucket not found/i.test(error.message)
    ) {
      return {
        status: 500,
        message: `Storage non pronto: bucket "${error.details.bucket ?? "site-images"}" assente o non accessibile. Contatta l'amministratore.`,
      };
    }
    return { status: 500, message: error.message };
  }
  if (error instanceof Error) {
    if (/formato immagine non supportato/i.test(error.message)) {
      return { status: 400, message: error.message };
    }
    if (/supera la dimensione massima/i.test(error.message)) {
      return { status: 400, message: error.message };
    }
    if (/svg non sicuro/i.test(error.message)) {
      return { status: 400, message: error.message };
    }
    return { status: 500, message: error.message };
  }
  return { status: 500, message: "Caricamento immagine non riuscito." };
}

/** Rifiuta SVG con payload eseguibili (script / handler / javascript:). */
export function assertSafeSocialStudioSvg(buffer: Buffer): void {
  const text = buffer.toString("utf8");
  if (
    /<script[\s>]/i.test(text) ||
    /\bon\w+\s*=/i.test(text) ||
    /javascript\s*:/i.test(text) ||
    /<foreignObject[\s>]/i.test(text) ||
    /data:text\/html/i.test(text)
  ) {
    throw new Error(
      "SVG non sicuro: rimuovi script, event handler o riferimenti javascript prima del caricamento.",
    );
  }
}

export async function saveSocialStudioImage(params: {
  subfolder: "assets" | "graphics";
  fileBuffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<{ path: string; publicUrl: string }> {
  const mimeType = (params.mimeType || "image/png").toLowerCase();
  if (!isAllowedSiteImageMime(mimeType)) {
    throw new Error("Formato immagine non supportato. Usa JPG, PNG, WEBP o SVG.");
  }
  if (params.fileBuffer.length === 0) {
    throw new Error("File immagine vuoto.");
  }
  if (params.fileBuffer.length > SITE_IMAGE_MAX_BYTES) {
    throw new Error("L'immagine supera la dimensione massima di 8 MB.");
  }
  if (mimeType === "image/svg+xml") {
    assertSafeSocialStudioSvg(params.fileBuffer);
  }

  await ensureSiteImagesBucket();

  const extension = MIME_EXTENSION[mimeType] ?? ".bin";
  const safeFileName = normalizeFileName(params.originalName, extension);
  const finalPath = `social-studio/${params.subfolder}/${Date.now()}-${safeFileName}`;
  const { client, bucket } = getClient();

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
        ? `Bucket Storage "${bucket}" non trovato su Supabase.`
        : `Impossibile salvare l'immagine Social Studio (${storageError.message}).`,
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
  if (!data.publicUrl) {
    throw new Error("Upload riuscito ma URL pubblico non disponibile.");
  }
  return { path: finalPath, publicUrl: data.publicUrl };
}
