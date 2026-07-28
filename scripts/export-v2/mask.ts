/**
 * Privacy helpers for audit reports. Never expose full PII or secrets.
 */

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "(empty)";
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const localMasked = local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
  const domainParts = domain.split(".");
  const domainMasked = domainParts
    .map((part, index) => (index === domainParts.length - 1 ? part : `${part[0] ?? "*"}***`))
    .join(".");
  return `${localMasked}@${domainMasked}`;
}

export function truncateId(id: string, keep = 8): string {
  if (id.length <= keep) return id;
  return `${id.slice(0, keep)}…`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeTaxCode(taxCode: string): string {
  return taxCode.replace(/\s+/g, "").toUpperCase();
}

export function normalizeStoragePath(filePath: string): string {
  return filePath.trim().replaceAll("\\", "/").replace(/^\/+/, "");
}

export function getPathBasename(filePath: string): string {
  const normalized = normalizeStoragePath(filePath);
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) ?? normalized;
}

/** Normalize receipt DB paths to the canonical receipts/{name} form used in Storage. */
export function normalizeReceiptObjectPath(filePath: string): string {
  const normalized = normalizeStoragePath(filePath);
  if (normalized.startsWith("supabase://")) {
    const withoutScheme = normalized.slice("supabase://".length);
    const firstSlash = withoutScheme.indexOf("/");
    if (firstSlash >= 0) {
      return normalizeReceiptObjectPath(withoutScheme.slice(firstSlash + 1));
    }
  }
  if (normalized.startsWith("receipts/")) {
    return normalized;
  }
  if (normalized.startsWith("public/receipts/")) {
    return `receipts/${getPathBasename(normalized)}`;
  }
  return `receipts/${getPathBasename(normalized)}`;
}

export function assertNoSecretsInText(text: string): string[] {
  const findings: string[] = [];
  if (/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/.test(text)) {
    findings.push("possible_bcrypt_hash");
  }
  if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(text)) {
    findings.push("possible_jwt");
  }
  if (/postgresql:\/\/[^\s"']+/i.test(text)) {
    findings.push("possible_database_url");
  }
  // Require an assigned secret-like value, not merely the env var name in docs.
  if (/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?[A-Za-z0-9._\-]{20,}/i.test(text)) {
    findings.push("possible_service_role");
  }
  if (/DATABASE_URL\s*[:=]\s*["']?postgresql:\/\//i.test(text)) {
    findings.push("possible_database_url_assignment");
  }
  return findings;
}
