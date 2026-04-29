import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type NodeErrorWithCode = Error & { code?: string };

const LEGACY_PUBLIC_DIR = path.join(process.cwd(), "public", "receipts");
const LEGACY_STORAGE_DIR = path.join(process.cwd(), "storage", "receipts");

type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export class ReceiptStorageError extends Error {
  constructor(
    message: string,
    public readonly details: {
      stage: "upload" | "download" | "legacy-read";
      bucket?: string;
      bucketPath?: string;
      absolutePath?: string;
      code?: string;
      originalMessage?: string;
      reason?:
        | "SUPABASE_DOWNLOAD_NOT_FOUND"
        | "SUPABASE_DOWNLOAD_ERROR"
        | "LEGACY_FILE_NOT_FOUND"
        | "LEGACY_FILE_READ_ERROR";
    },
  ) {
    super(message);
    this.name = "ReceiptStorageError";
  }
}

function getStorageEnv() {
  return {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_RECEIPTS_BUCKET,
  };
}

function hasConfiguredSupabaseStorage() {
  const env = getStorageEnv();
  return Boolean(env.url && env.serviceRoleKey && env.bucket);
}

function getSupabaseStorageConfigOrNull(): SupabaseStorageConfig | null {
  const env = getStorageEnv();
  if (!env.url || !env.serviceRoleKey || !env.bucket) {
    return null;
  }
  const supabaseUrlOrigin = new URL(env.url).origin;
  return {
    url: supabaseUrlOrigin,
    serviceRoleKey: env.serviceRoleKey,
    bucket: env.bucket,
  };
}

function getSupabaseStorageClientOrNull(): { client: SupabaseClient; bucket: string } | null {
  const config = getSupabaseStorageConfigOrNull();
  if (!config) {
    return null;
  }
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
  if (normalized.startsWith("receipts/")) {
    return normalized;
  }
  return `receipts/${path.basename(normalized)}`;
}

function getLegacyCandidates(filePath: string): string[] {
  const safeBasename = path.basename(filePath.replaceAll("\\", "/"));
  return [path.join(LEGACY_PUBLIC_DIR, safeBasename), path.join(LEGACY_STORAGE_DIR, safeBasename)];
}

async function readLegacyReceipt(filePath: string): Promise<Buffer> {
  const candidates = getLegacyCandidates(filePath);
  let lastError: NodeErrorWithCode | null = null;

  for (const absolutePath of candidates) {
    try {
      return await readFile(absolutePath);
    } catch (error) {
      lastError = error as NodeErrorWithCode;
      if (lastError.code !== "ENOENT") {
        throw new ReceiptStorageError("Impossibile leggere il file ricevuta locale.", {
          stage: "legacy-read",
          absolutePath,
          code: lastError.code,
          originalMessage: lastError.message,
          reason: "LEGACY_FILE_READ_ERROR",
        });
      }
    }
  }

  throw new ReceiptStorageError("File ricevuta non disponibile.", {
    stage: "legacy-read",
    absolutePath: candidates[0],
    code: lastError?.code ?? "ENOENT",
    originalMessage: lastError?.message,
    reason: "LEGACY_FILE_NOT_FOUND",
  });
}

export async function saveReceiptPdf(fileName: string, pdfBuffer: Buffer): Promise<string> {
  const bucketPath = `receipts/${fileName}`;
  const supabase = getSupabaseStorageClientOrNull();
  if (supabase) {
    const { client, bucket } = supabase;
    const { error } = await client.storage.from(bucket).upload(bucketPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) {
      throw new ReceiptStorageError("Impossibile salvare la ricevuta su Supabase Storage.", {
        stage: "upload",
        bucket,
        bucketPath,
        code: (error as NodeErrorWithCode).code,
        originalMessage: error.message,
      });
    }
    return bucketPath;
  }

  await mkdir(LEGACY_PUBLIC_DIR, { recursive: true });
  const absolutePath = path.join(LEGACY_PUBLIC_DIR, fileName);
  await writeFile(absolutePath, pdfBuffer);
  return `receipts/${fileName}`;
}

export async function readReceiptPdf(filePath: string): Promise<Buffer> {
  const bucketPath = normalizeBucketPath(filePath);
  const supabase = getSupabaseStorageClientOrNull();
  if (supabase) {
    const { client, bucket } = supabase;
    const { data, error } = await client.storage.from(bucket).download(bucketPath);
    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    if (error && error.message?.toLowerCase().includes("not found")) {
      return readLegacyReceipt(filePath);
    }

    if (error) {
      throw new ReceiptStorageError("Errore durante il download da Supabase Storage.", {
        stage: "download",
        bucket,
        bucketPath,
        code: (error as NodeErrorWithCode).code,
        originalMessage: error.message,
        reason: "SUPABASE_DOWNLOAD_ERROR",
      });
    }
  }

  if (!hasConfiguredSupabaseStorage()) {
    return readLegacyReceipt(filePath);
  }

  throw new ReceiptStorageError("File ricevuta non disponibile su storage.", {
    stage: "download",
    bucketPath,
    reason: "SUPABASE_DOWNLOAD_NOT_FOUND",
  });
}
