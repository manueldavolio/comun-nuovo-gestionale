import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SITE_IMAGE_MAX_BYTES,
  SITE_IMAGES_BUCKET_NAME,
  SiteImageStorageError,
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

export async function saveSocialStudioImage(params: {
  subfolder: "assets" | "graphics";
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
  const safeFileName = normalizeFileName(params.originalName, extension);
  const finalPath = `social-studio/${params.subfolder}/${Date.now()}-${safeFileName}`;
  const { client, bucket } = getClient();

  const { error } = await client.storage.from(bucket).upload(finalPath, params.fileBuffer, {
    contentType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
    upsert: false,
  });

  if (error) {
    const storageError = error as Error & { code?: string };
    throw new SiteImageStorageError("Impossibile salvare l'immagine Social Studio.", {
      stage: "upload",
      bucket,
      bucketPath: finalPath,
      code: storageError.code,
      originalMessage: storageError.message,
    });
  }

  const { data } = client.storage.from(bucket).getPublicUrl(finalPath);
  return { path: finalPath, publicUrl: data.publicUrl };
}
