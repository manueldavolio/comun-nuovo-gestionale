import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type NodeErrorWithCode = Error & { code?: string };

type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export type ReceiptStorageMissingEnv =
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_RECEIPTS_BUCKET";

export class ReceiptStorageError extends Error {
  constructor(
    message: string,
    public readonly details: {
      stage: "env" | "upload" | "download";
      missingEnv?: ReceiptStorageMissingEnv;
      bucket?: string;
      bucketPath?: string;
      code?: string;
      originalMessage?: string;
      reason?:
        | "SUPABASE_DOWNLOAD_NOT_FOUND"
        | "SUPABASE_DOWNLOAD_ERROR"
        | "SUPABASE_RECEIPTS_BUCKET_MISSING"
        | "SUPABASE_RECEIPTS_BUCKET_INVALID";
    },
  ) {
    super(message);
    this.name = "ReceiptStorageError";
  }
}

/** Nome fisso del bucket sanitario — mai usarlo per le ricevute. */
export const MEDICAL_VISITS_BUCKET_NAME = "medical-visit-certificates";

/**
 * Risolve la config storage ricevute.
 * Richiede SUPABASE_RECEIPTS_BUCKET esplicito; nessun fallback a bucket sanitari.
 */
export function resolveReceiptsStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseStorageConfig {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const receiptsBucket = env.SUPABASE_RECEIPTS_BUCKET?.trim();
  const medicalBucket = env.SUPABASE_MEDICAL_VISITS_BUCKET?.trim();

  if (!url) {
    throw new ReceiptStorageError("Configurazione Supabase Storage mancante: SUPABASE_URL.", {
      stage: "env",
      missingEnv: "SUPABASE_URL",
      code: "SUPABASE_STORAGE_ENV_MISSING",
    });
  }
  if (!serviceRoleKey) {
    throw new ReceiptStorageError(
      "Configurazione Supabase Storage mancante: SUPABASE_SERVICE_ROLE_KEY.",
      {
        stage: "env",
        missingEnv: "SUPABASE_SERVICE_ROLE_KEY",
        code: "SUPABASE_STORAGE_ENV_MISSING",
      },
    );
  }
  if (!receiptsBucket) {
    throw new ReceiptStorageError(
      "Configurazione Supabase Storage mancante: impostare SUPABASE_RECEIPTS_BUCKET (bucket dedicato alle ricevute). Nessun fallback verso bucket sanitari.",
      {
        stage: "env",
        missingEnv: "SUPABASE_RECEIPTS_BUCKET",
        code: "SUPABASE_RECEIPTS_BUCKET_MISSING",
        reason: "SUPABASE_RECEIPTS_BUCKET_MISSING",
      },
    );
  }

  if (
    receiptsBucket === MEDICAL_VISITS_BUCKET_NAME ||
    (medicalBucket && receiptsBucket === medicalBucket)
  ) {
    throw new ReceiptStorageError(
      "SUPABASE_RECEIPTS_BUCKET non può coincidere con il bucket dei certificati medici.",
      {
        stage: "env",
        bucket: receiptsBucket,
        code: "SUPABASE_RECEIPTS_BUCKET_INVALID",
        reason: "SUPABASE_RECEIPTS_BUCKET_INVALID",
      },
    );
  }

  return {
    url: new URL(url).origin,
    serviceRoleKey,
    bucket: receiptsBucket,
  };
}

function getSupabaseStorageClient(): { client: SupabaseClient; bucket: string } {
  const config = resolveReceiptsStorageConfig();
  return {
    client: createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    bucket: config.bucket,
  };
}

function getSafeBasename(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) ?? "receipt.pdf";
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
  const { client, bucket } = getSupabaseStorageClient();

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
  const { client, bucket } = getSupabaseStorageClient();

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
