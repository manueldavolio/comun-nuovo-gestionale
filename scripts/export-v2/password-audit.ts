import type { PasswordAuditSummary, PasswordHashClass } from "./types";

const BCRYPT_RE = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/;

export type PasswordClassification = {
  class: PasswordHashClass;
  costFactor: number | null;
};

export function classifyPasswordHash(hash: string | null | undefined): PasswordClassification {
  if (hash == null || hash.trim() === "") {
    return { class: "EMPTY_OR_NULL", costFactor: null };
  }

  const value = hash.trim();

  if (value.startsWith("scrypt:") || value.startsWith("$scrypt$") || /^scrypt\$/i.test(value)) {
    return { class: "SCRYPT", costFactor: null };
  }

  if (value.startsWith("$argon2") || value.toLowerCase().startsWith("argon2")) {
    return { class: "ARGON2", costFactor: null };
  }

  if (value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$")) {
    const match = BCRYPT_RE.exec(value);
    if (!match) {
      return { class: "BCRYPT_MALFORMED", costFactor: null };
    }
    const costFactor = Number.parseInt(match[1], 10);
    return { class: "BCRYPT_VALID_FORMAT", costFactor };
  }

  return { class: "UNKNOWN", costFactor: null };
}

export function summarizePasswordHashes(
  users: Array<{ id: string; passwordHash: string | null | undefined }>,
): PasswordAuditSummary {
  const costFactorDistribution: Record<string, number> = {};
  const problematicUserIds: PasswordAuditSummary["problematicUserIds"] = {
    bcryptMalformed: [],
    emptyOrNull: [],
    unknown: [],
    scrypt: [],
    argon2: [],
  };

  let bcryptImportable = 0;
  let bcryptMalformed = 0;
  let emptyOrNull = 0;
  let scrypt = 0;
  let argon2 = 0;
  let unknown = 0;

  for (const user of users) {
    const { class: hashClass, costFactor } = classifyPasswordHash(user.passwordHash);
    switch (hashClass) {
      case "BCRYPT_VALID_FORMAT":
        bcryptImportable += 1;
        if (costFactor != null) {
          const key = String(costFactor);
          costFactorDistribution[key] = (costFactorDistribution[key] ?? 0) + 1;
        }
        break;
      case "BCRYPT_MALFORMED":
        bcryptMalformed += 1;
        problematicUserIds.bcryptMalformed.push(user.id);
        break;
      case "EMPTY_OR_NULL":
        emptyOrNull += 1;
        problematicUserIds.emptyOrNull.push(user.id);
        break;
      case "SCRYPT":
        scrypt += 1;
        problematicUserIds.scrypt.push(user.id);
        break;
      case "ARGON2":
        argon2 += 1;
        problematicUserIds.argon2.push(user.id);
        break;
      case "UNKNOWN":
        unknown += 1;
        problematicUserIds.unknown.push(user.id);
        break;
      default:
        break;
    }
  }

  // App login requires a non-empty hash (src/lib/auth.ts). EMPTY_OR_NULL users cannot sign in
  // and need reset → counted in resetRequired. Severity treated as WARNING in relation report
  // (accounts exist but cannot authenticate), while BCRYPT_MALFORMED/UNKNOWN/SCRYPT/ARGON2 are BLOCKING.
  const resetRequired = emptyOrNull + bcryptMalformed + scrypt + argon2 + unknown;

  return {
    totalUsers: users.length,
    bcryptImportable,
    bcryptMalformed,
    emptyOrNull,
    scrypt,
    argon2,
    unknown,
    resetRequired,
    costFactorDistribution,
    problematicUserIds,
  };
}
