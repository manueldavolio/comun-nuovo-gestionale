import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  MEDICAL_VISITS_BUCKET_NAME,
  ReceiptStorageError,
  resolveReceiptsStorageConfig,
} from "@/lib/receipt-storage";

function envStub(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as unknown as NodeJS.ProcessEnv;
}

describe("receipt storage bucket isolation", () => {
  it("requires explicit SUPABASE_RECEIPTS_BUCKET and does not fall back to medical env", () => {
    assert.throws(
      () =>
        resolveReceiptsStorageConfig(
          envStub({
            SUPABASE_URL: "https://example.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
            SUPABASE_MEDICAL_VISITS_BUCKET: MEDICAL_VISITS_BUCKET_NAME,
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof ReceiptStorageError);
        assert.equal(error.details.missingEnv, "SUPABASE_RECEIPTS_BUCKET");
        assert.equal(error.details.reason, "SUPABASE_RECEIPTS_BUCKET_MISSING");
        assert.match(error.message, /SUPABASE_RECEIPTS_BUCKET/);
        assert.doesNotMatch(error.message, /medical-visit/i);
        return true;
      },
    );
  });

  it("resolves the configured receipts bucket when present", () => {
    const config = resolveReceiptsStorageConfig(
      envStub({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SUPABASE_RECEIPTS_BUCKET: "receipts",
        SUPABASE_MEDICAL_VISITS_BUCKET: MEDICAL_VISITS_BUCKET_NAME,
      }),
    );

    assert.equal(config.bucket, "receipts");
    assert.equal(config.url, "https://example.supabase.co");
    assert.notEqual(config.bucket, MEDICAL_VISITS_BUCKET_NAME);
  });

  it("rejects receipts bucket equal to the medical certificates bucket name", () => {
    assert.throws(
      () =>
        resolveReceiptsStorageConfig(
          envStub({
            SUPABASE_URL: "https://example.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
            SUPABASE_RECEIPTS_BUCKET: MEDICAL_VISITS_BUCKET_NAME,
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof ReceiptStorageError);
        assert.equal(error.details.reason, "SUPABASE_RECEIPTS_BUCKET_INVALID");
        assert.equal(error.details.bucket, MEDICAL_VISITS_BUCKET_NAME);
        return true;
      },
    );
  });

  it("rejects receipts bucket equal to SUPABASE_MEDICAL_VISITS_BUCKET value", () => {
    assert.throws(
      () =>
        resolveReceiptsStorageConfig(
          envStub({
            SUPABASE_URL: "https://example.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
            SUPABASE_RECEIPTS_BUCKET: "custom-medical-bucket",
            SUPABASE_MEDICAL_VISITS_BUCKET: "custom-medical-bucket",
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof ReceiptStorageError);
        assert.equal(error.details.reason, "SUPABASE_RECEIPTS_BUCKET_INVALID");
        return true;
      },
    );
  });

  it("source code has no medical bucket fallback for receipts", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/receipt-storage.ts"), "utf8");
    assert.equal(source.includes("SUPABASE_MEDICAL_VISITS_BUCKET ??"), false);
    assert.equal(source.includes("DEFAULT_MEDICAL_VISITS_BUCKET"), false);
    assert.match(source, /SUPABASE_RECEIPTS_BUCKET/);
    assert.match(source, /SUPABASE_RECEIPTS_BUCKET_MISSING/);
  });
});
