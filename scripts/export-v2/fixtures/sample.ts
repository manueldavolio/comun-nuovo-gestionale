/**
 * Pure fixtures for audit exporter unit tests (no real DB / Storage).
 */
export const FIXTURE_BCRYPT_VALID =
  "$2a$12$ABCDEFGHIJKLMNOPQRSTUV0123456789abcdefghijklmnopqrsTU";

export const FIXTURE_BCRYPT_MALFORMED = "$2a$12$not-valid";

export const FIXTURE_USERS = [
  { id: "u-ok", email: "ok@example.com", passwordHash: FIXTURE_BCRYPT_VALID },
  { id: "u-empty", email: "empty@example.com", passwordHash: "" },
  { id: "u-bad", email: "bad@example.com", passwordHash: FIXTURE_BCRYPT_MALFORMED },
];

export const FIXTURE_STORAGE_OBJECT = {
  bucket: "enrollment-documents",
  path: "pending/user1/parent_id_front-1.pdf",
  name: "parent_id_front-1.pdf",
  sizeBytes: 1234,
  mimeType: "application/pdf",
  createdAt: null,
  updatedAt: null,
  etag: null,
  source: "SUPABASE" as const,
  domain: "ENROLLMENT_DOCUMENT" as const,
};
