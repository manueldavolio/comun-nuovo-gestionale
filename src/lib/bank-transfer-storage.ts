import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BANK_TRANSFER_PROOF_MAX_BYTES = 8 * 1024 * 1024;
export const BANK_TRANSFER_PROOFS_BUCKET_NAME = "bank-transfer-proofs";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

const MIME_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export class BankTransferProofStorageError extends Error {
  constructor(
    message: string,
    public readonly details: {
      stage: "env" | "validate" | "upload" | "download";
      code?: string;
      missingEnv?: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "SUPABASE_BANK_TRANSFER_PROOFS_BUCKET";
      originalMessage?: string;
    },
  ) {
    super(message);
    this.name = "BankTransferProofStorageError";
  }
}

function getStorageEnv() {
  return {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_BANK_TRANSFER_PROOFS_BUCKET,
  };
}

export function validateBankTransferProofStorageEnv(): SupabaseStorageConfig {
  const env = getStorageEnv();
  const missingEnv =
    !env.url
      ? "SUPABASE_URL"
      : !env.serviceRoleKey
        ? "SUPABASE_SERVICE_ROLE_KEY"
        : !env.bucket
          ? "SUPABASE_BANK_TRANSFER_PROOFS_BUCKET"
          : null;

  if (missingEnv) {
    throw new BankTransferProofStorageError(
      `Configurazione Supabase Storage mancante: ${missingEnv}.`,
      { stage: "env", code: "SUPABASE_STORAGE_ENV_MISSING", missingEnv },
    );
  }

  if (env.bucket !== BANK_TRANSFER_PROOFS_BUCKET_NAME) {
    throw new BankTransferProofStorageError(
      `Bucket Supabase non valido: usare ${BANK_TRANSFER_PROOFS_BUCKET_NAME}.`,
      { stage: "env", code: "SUPABASE_STORAGE_BUCKET_INVALID" },
    );
  }

  return {
    url: env.url,
    serviceRoleKey: env.serviceRoleKey,
    bucket: env.bucket,
  } as SupabaseStorageConfig;
}

function createServiceClient(config: SupabaseStorageConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function validateBankTransferProofFile(input: {
  mimeType: string;
  byteLength: number;
}): { mimeType: string; extension: string } {
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new BankTransferProofStorageError(
      "Formato non supportato. Usa PDF, JPG o PNG.",
      { stage: "validate", code: "INVALID_MIME" },
    );
  }
  if (input.byteLength <= 0 || input.byteLength > BANK_TRANSFER_PROOF_MAX_BYTES) {
    throw new BankTransferProofStorageError(
      `Dimensione file non valida (max ${Math.floor(BANK_TRANSFER_PROOF_MAX_BYTES / (1024 * 1024))} MB).`,
      { stage: "validate", code: "INVALID_SIZE" },
    );
  }
  return { mimeType, extension: MIME_EXTENSION[mimeType] };
}

export function buildBankTransferProofObjectPath(input: {
  requestId: string;
  extension: string;
}): string {
  const safeId = input.requestId.replace(/[^a-zA-Z0-9_-]/g, "");
  const stamp = Date.now();
  return `bank-transfers/${safeId}/${stamp}${input.extension}`;
}

export async function uploadBankTransferProof(input: {
  requestId: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ objectPath: string; mimeType: string }> {
  const validated = validateBankTransferProofFile({
    mimeType: input.mimeType,
    byteLength: input.bytes.byteLength,
  });
  const config = validateBankTransferProofStorageEnv();
  const objectPath = buildBankTransferProofObjectPath({
    requestId: input.requestId,
    extension: validated.extension,
  });
  const client = createServiceClient(config);
  const { error } = await client.storage.from(config.bucket).upload(objectPath, input.bytes, {
    contentType: validated.mimeType,
    upsert: false,
  });
  if (error) {
    throw new BankTransferProofStorageError("Upload contabile non riuscito.", {
      stage: "upload",
      code: "UPLOAD_FAILED",
      originalMessage: error.message,
    });
  }
  return { objectPath, mimeType: validated.mimeType };
}

export async function downloadBankTransferProof(objectPath: string): Promise<{
  bytes: Buffer;
  contentType: string;
  fileName: string;
}> {
  const config = validateBankTransferProofStorageEnv();
  const client = createServiceClient(config);
  const { data, error } = await client.storage.from(config.bucket).download(objectPath);
  if (error || !data) {
    throw new BankTransferProofStorageError("Download contabile non riuscito.", {
      stage: "download",
      code: "DOWNLOAD_FAILED",
      originalMessage: error?.message,
    });
  }
  const arrayBuffer = await data.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  const ext = path.extname(objectPath).toLowerCase();
  const contentType =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".png"
        ? "image/png"
        : "image/jpeg";
  return {
    bytes,
    contentType,
    fileName: path.basename(objectPath),
  };
}
