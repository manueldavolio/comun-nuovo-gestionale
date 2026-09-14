import { randomBytes } from "node:crypto";

const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

/**
 * Cryptographically random temporary password for admin reset.
 * Never log or persist the plaintext result.
 */
export function generateTemporaryPassword(length = 16): string {
  if (length < 12) {
    throw new Error("Temporary password must be at least 12 characters.");
  }

  const bytes = randomBytes(length);
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += TEMP_PASSWORD_ALPHABET[bytes[index]! % TEMP_PASSWORD_ALPHABET.length];
  }
  return password;
}

/** Prisma update payload: only passwordHash (updatedAt is handled by @updatedAt). */
export function buildPasswordHashUpdateData(passwordHash: string) {
  return { passwordHash } as const;
}
