/**
 * Validazione filePath metadata dell'archivio Document (non blob store).
 * Blocca URL pubblici/esterni e path traversal; consente placeholder relativi storici.
 */

export type ArchiveDocumentPathValidation =
  | { ok: true; normalizedPath: string }
  | { ok: false; code: "EMPTY" | "EXTERNAL_URL" | "TRAVERSAL" | "ABSOLUTE" | "INVALID_CHARS" };

export function validateArchiveDocumentFilePath(filePath: string): ArchiveDocumentPathValidation {
  if (!filePath || !filePath.trim()) {
    return { ok: false, code: "EMPTY" };
  }

  const trimmed = filePath.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return { ok: false, code: "EXTERNAL_URL" };
  }

  const normalized = trimmed.replaceAll("\\", "/");
  if (normalized.includes("\0") || /[\u0001-\u001f]/.test(normalized)) {
    return { ok: false, code: "INVALID_CHARS" };
  }

  if (normalized.includes("..")) {
    return { ok: false, code: "TRAVERSAL" };
  }

  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized)) {
    return { ok: false, code: "ABSOLUTE" };
  }

  if (!normalized.replace(/^\/+/, "").length) {
    return { ok: false, code: "EMPTY" };
  }

  return { ok: true, normalizedPath: normalized.replace(/^\/+/, "") };
}

export function archiveDocumentPathErrorMessage(
  code: Exclude<ArchiveDocumentPathValidation, { ok: true }>["code"],
): string {
  switch (code) {
    case "EXTERNAL_URL":
      return "FilePath non valido: URL esterni o pubblici non ammessi.";
    case "TRAVERSAL":
      return "FilePath non valido.";
    case "ABSOLUTE":
      return "FilePath non valido: usare un percorso relativo interno.";
    case "EMPTY":
      return "FilePath obbligatorio.";
    case "INVALID_CHARS":
      return "FilePath non valido.";
  }
}
