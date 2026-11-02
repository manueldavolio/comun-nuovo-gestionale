import { createHash } from "node:crypto";

/** Normalizza il testo prima dell'hash (LF, trim finale). */
export function normalizeLegalDocumentBody(bodyText: string): string {
  return bodyText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd() + "\n";
}

export function sha256HexOfLegalDocumentBody(bodyText: string): string {
  const normalized = normalizeLegalDocumentBody(bodyText);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
