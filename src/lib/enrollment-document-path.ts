/**
 * Validazione percorsi storage documenti iscrizione (identità minori / genitore).
 * Compatibile con path storici `pending/{userId}/...` e canonici `enrollment-documents/{enrollmentId}/...`.
 * Non accetta URL esterni né path traversal.
 */

const PENDING_PREFIX = "pending/";
const CANONICAL_PREFIX = "enrollment-documents/";

export type EnrollmentDocumentPathValidation =
  | { ok: true; normalizedPath: string; kind: "pending" | "canonical" }
  | { ok: false; code: "EMPTY" | "TRAVERSAL" | "EXTERNAL_URL" | "ABSOLUTE" | "UNSUPPORTED_PREFIX" | "INVALID_CHARS" };

function stripSupabaseScheme(path: string): string {
  if (!path.startsWith("supabase://")) {
    return path;
  }
  const withoutScheme = path.slice("supabase://".length);
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash < 0) {
    return "";
  }
  return withoutScheme.slice(firstSlash + 1);
}

export function normalizeEnrollmentDocumentStoragePath(filePath: string): string {
  return stripSupabaseScheme(filePath.trim().replaceAll("\\", "/")).replace(/^\/+/, "");
}

/**
 * Valida un path già presente in DB prima della lettura storage.
 * Non inventa path: rifiuta qualsiasi cosa fuori dai prefissi noti.
 */
export function validateEnrollmentDocumentStoragePath(
  filePath: string,
): EnrollmentDocumentPathValidation {
  if (!filePath || !filePath.trim()) {
    return { ok: false, code: "EMPTY" };
  }

  const trimmed = filePath.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !trimmed.toLowerCase().startsWith("supabase://")) {
    return { ok: false, code: "EXTERNAL_URL" };
  }

  const normalized = normalizeEnrollmentDocumentStoragePath(trimmed);
  if (!normalized) {
    return { ok: false, code: "EMPTY" };
  }

  if (normalized.includes("\0") || /[\u0001-\u001f]/.test(normalized)) {
    return { ok: false, code: "INVALID_CHARS" };
  }

  if (normalized.includes("..") || normalized.split("/").some((segment) => segment === "..")) {
    return { ok: false, code: "TRAVERSAL" };
  }

  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized)) {
    return { ok: false, code: "ABSOLUTE" };
  }

  if (normalized.startsWith(PENDING_PREFIX)) {
    const rest = normalized.slice(PENDING_PREFIX.length);
    if (!rest || rest.includes("//") || rest.split("/").some((s) => !s)) {
      return { ok: false, code: "UNSUPPORTED_PREFIX" };
    }
    // pending/{userId}/file...
    const parts = rest.split("/");
    if (parts.length < 2 || !parts[0] || !parts[parts.length - 1]) {
      return { ok: false, code: "UNSUPPORTED_PREFIX" };
    }
    return { ok: true, normalizedPath: normalized, kind: "pending" };
  }

  if (normalized.startsWith(CANONICAL_PREFIX)) {
    const rest = normalized.slice(CANONICAL_PREFIX.length);
    const parts = rest.split("/");
    if (parts.length < 2 || !parts[0] || !parts[parts.length - 1]) {
      return { ok: false, code: "UNSUPPORTED_PREFIX" };
    }
    return { ok: true, normalizedPath: normalized, kind: "canonical" };
  }

  return { ok: false, code: "UNSUPPORTED_PREFIX" };
}

export function enrollmentDocumentPathErrorMessage(
  code: Exclude<EnrollmentDocumentPathValidation, { ok: true }>["code"],
): string {
  switch (code) {
    case "EXTERNAL_URL":
      return "Percorso documento non valido: URL esterni non ammessi.";
    case "TRAVERSAL":
      return "Percorso documento non valido.";
    case "ABSOLUTE":
      return "Percorso documento non valido.";
    case "EMPTY":
      return "Percorso documento mancante.";
    case "INVALID_CHARS":
      return "Percorso documento non valido.";
    case "UNSUPPORTED_PREFIX":
      return "Percorso documento non riconosciuto.";
  }
}
