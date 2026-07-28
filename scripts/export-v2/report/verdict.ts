import type { AuditIssue, AuditReport, AuditVerdict, PasswordAuditSummary } from "../types";

export function computeVerdict(input: {
  fundamentalReadable: boolean;
  storageInventoryFailed: boolean;
  issues: AuditIssue[];
  password: PasswordAuditSummary;
}): { verdict: AuditVerdict; exitCode: 0 | 1 | 2 } {
  const blocking = input.issues.filter((i) => i.severity === "BLOCKING");
  const warnings = input.issues.filter((i) => i.severity === "WARNING");

  if (!input.fundamentalReadable) {
    return { verdict: "BLOCKED", exitCode: 1 };
  }

  if (input.storageInventoryFailed) {
    return { verdict: "BLOCKED", exitCode: 1 };
  }

  if (
    input.password.bcryptMalformed > 0 ||
    input.password.unknown > 0 ||
    input.password.scrypt > 0 ||
    input.password.argon2 > 0
  ) {
    return { verdict: "BLOCKED", exitCode: 1 };
  }

  if (blocking.length > 0) {
    return { verdict: "BLOCKED", exitCode: 1 };
  }

  if (warnings.length > 0 || input.password.emptyOrNull > 0) {
    return { verdict: "READY_FOR_EXPORT_WITH_WARNINGS", exitCode: 0 };
  }

  return { verdict: "READY_FOR_EXPORT", exitCode: 0 };
}

export function passwordIssuesFromSummary(password: PasswordAuditSummary): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (password.bcryptMalformed > 0) {
    issues.push({
      code: "PASSWORD_BCRYPT_MALFORMED",
      severity: "BLOCKING",
      message: "Users with malformed bcrypt passwordHash.",
      model: "User",
      recordIds: password.problematicUserIds.bcryptMalformed,
    });
  }
  if (password.unknown > 0) {
    issues.push({
      code: "PASSWORD_HASH_UNKNOWN",
      severity: "BLOCKING",
      message: "Users with unknown password hash algorithm.",
      model: "User",
      recordIds: password.problematicUserIds.unknown,
    });
  }
  if (password.scrypt > 0) {
    issues.push({
      code: "PASSWORD_SCRYPT",
      severity: "BLOCKING",
      message: "Users with scrypt hashes (not bcrypt import path).",
      model: "User",
      recordIds: password.problematicUserIds.scrypt,
    });
  }
  if (password.argon2 > 0) {
    issues.push({
      code: "PASSWORD_ARGON2",
      severity: "BLOCKING",
      message: "Users with argon2 hashes (not bcrypt import path).",
      model: "User",
      recordIds: password.problematicUserIds.argon2,
    });
  }
  if (password.emptyOrNull > 0) {
    // App auth rejects empty hash (src/lib/auth.ts). Treated as WARNING: accounts need reset,
    // but do not alone block structural export readiness unless policy changes.
    issues.push({
      code: "PASSWORD_EMPTY_OR_NULL",
      severity: "WARNING",
      message:
        "Users with empty/null passwordHash cannot log in (app requires hash). Reset required before cutover.",
      model: "User",
      recordIds: password.problematicUserIds.emptyOrNull,
    });
  }
  return issues;
}

export function summarizeIssueCounts(issues: AuditIssue[]): AuditReport["summary"] {
  return {
    blocking: issues.filter((i) => i.severity === "BLOCKING").length,
    warning: issues.filter((i) => i.severity === "WARNING").length,
    info: issues.filter((i) => i.severity === "INFO").length,
  };
}
