import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type NodeErrorWithCode = Error & { code?: string };

type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export class ReceiptStorageError extends Error {
  constructor(
    message: string,
    public readonly details: {
      stage: "upload" | "download";
      missingEnv?: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY";
      bucket?: string;
      bucketPath?: string;
      code?: string;
      originalMessage?: string;
      reason?:
        | "SUPABASE_DOWNLOAD_NOT_FOUND"
        | "SUPABASE_DOWNLOAD_ERROR";
    },
  ) {
    super(message);
    this.name = "ReceiptStorageError";
  }
}

const DEFAULT_RECEIPTS_BUCKET = "receipts";
const DEFAULT_MEDICAL_VISITS_BUCKET = "medical-visit-certificates";

function getStorageEnv() {
  return {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket:
      process.env.SUPABASE_RECEIPTS_BUCKET ??
      process.env.SUPABASE_MEDICAL_VISITS_BUCKET ??
      DEFAULT_MEDICAL_VISITS_BUCKET,
  };
}

function getSafeBasename(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) ?? "receipt.pdf";
}

function getSupabaseStorageConfigOrNull(): SupabaseStorageConfig | null {
  const env = getStorageEnv();
  if (!env.url || !env.serviceRoleKey) {
    return null;
  }
  const supabaseUrlOrigin = new URL(env.url).origin;
  return {
    url: supabaseUrlOrigin,
    serviceRoleKey: env.serviceRoleKey,
    bucket: env.bucket ?? DEFAULT_RECEIPTS_BUCKET,
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
  return `receipts/${getSafeBasename(normalized)}`;
}

export async function saveReceiptPdf(fileName: string, pdfBuffer: Buffer): Promise<string> {
  const bucketPath = `receipts/${fileName}`;
  const supabase = getSupabaseStorageClientOrNull();
  if (!supabase) {
    const missingEnv = !process.env.SUPABASE_URL ? "SUPABASE_URL" : "SUPABASE_SERVICE_ROLE_KEY";
    throw new ReceiptStorageError(`Configurazione Supabase Storage mancante: ${missingEnv}.`, {
      stage: "upload",
      missingEnv,
      code: "SUPABASE_STORAGE_ENV_MISSING",
    });
  }

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

export async function readReceiptPdf(filePath: string): Promise<Buffer> {
  const bucketPath = normalizeBucketPath(filePath);
  const supabase = getSupabaseStorageClientOrNull();
  if (!supabase) {
    const missingEnv = !process.env.SUPABASE_URL ? "SUPABASE_URL" : "SUPABASE_SERVICE_ROLE_KEY";
    throw new ReceiptStorageError(`Configurazione Supabase Storage mancante: ${missingEnv}.`, {
      stage: "download",
      missingEnv,
      bucketPath,
      code: "SUPABASE_STORAGE_ENV_MISSING",
    });
  }

  const { client, bucket } = supabase;
  const { data, error } = await client.storage.from(bucket).download(bucketPath);
  if (!error && data) {
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (error && error.message?.toLowerCase().includes("not found")) {
    throw new ReceiptStorageError("File ricevuta non disponibile su storage.", {
      stage: "download",
      bucket,
      bucketPath,
      code: (error as NodeErrorWithCode).code,
      originalMessage: error.message,
      reason: "SUPABASE_DOWNLOAD_NOT_FOUND",
    });
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

  throw new ReceiptStorageError("File ricevuta non disponibile su storage.", {
    stage: "download",
    bucket,
    bucketPath,
    reason: "SUPABASE_DOWNLOAD_NOT_FOUND",
  });
}
