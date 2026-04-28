import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const MEDICAL_VISIT_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

const STORAGE_DIR = path.join(process.cwd(), "storage", "medical-visits");

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

const MIME_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

function getSafeBasename(filePath: string): string {
  return path.basename(filePath.replaceAll("\\", "/"));
}

export function isAllowedMedicalVisitCertificateMime(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function getMedicalVisitCertificateDownloadName(filePath: string): string {
  return getSafeBasename(filePath);
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

  const extFromMime = MIME_EXTENSION[mimeType];
  const originalExt = params.originalName ? path.extname(params.originalName).toLowerCase() : "";
  const extension = originalExt || extFromMime;
  const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${extension}`;

  await mkdir(STORAGE_DIR, { recursive: true });

  const absolutePath = path.join(STORAGE_DIR, fileName);
  await writeFile(absolutePath, params.fileBuffer);

  return `medical-visits/${fileName}`;
}

export async function readMedicalVisitCertificate(filePath: string): Promise<Buffer> {
  const safeBasename = getSafeBasename(filePath);
  const absolutePath = path.join(STORAGE_DIR, safeBasename);
  return readFile(absolutePath);
}
