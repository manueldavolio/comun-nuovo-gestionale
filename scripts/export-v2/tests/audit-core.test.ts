import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveEnrollmentDocumentsBucket,
  resolveMedicalCertificatesBucket,
  resolveReceiptsBucket,
  parseCliArgs,
} from "../config";
import { classifyPasswordHash, summarizePasswordHashes } from "../password-audit";
import {
  maskEmail,
  normalizeEmail,
  normalizeReceiptObjectPath,
  normalizeTaxCode,
  assertNoSecretsInText,
} from "../mask";
import { paginateNames } from "../storage/inventory";
import { matchFileReferences } from "../storage/references";
import { computeVerdict, passwordIssuesFromSummary } from "../report/verdict";
import { buildMarkdownReport } from "../report/markdown-report";
import type { AuditReport, StorageObjectRecord } from "../types";

describe("bucket resolution", () => {
  it("resolves enrollment documents bucket with default", () => {
    const r = resolveEnrollmentDocumentsBucket({});
    assert.equal(r.bucket, "enrollment-documents");
  });

  it("resolves medical bucket from env", () => {
    const r = resolveMedicalCertificatesBucket({
      SUPABASE_MEDICAL_VISITS_BUCKET: "medical-visit-certificates",
    });
    assert.equal(r.bucket, "medical-visit-certificates");
    assert.equal(r.sourceEnv, "SUPABASE_MEDICAL_VISITS_BUCKET");
  });

  it("resolves receipts with receipts bucket first", () => {
    const r = resolveReceiptsBucket({
      SUPABASE_RECEIPTS_BUCKET: "receipts",
      SUPABASE_MEDICAL_VISITS_BUCKET: "medical-visit-certificates",
    });
    assert.equal(r.bucket, "receipts");
    assert.equal(r.sourceEnv, "SUPABASE_RECEIPTS_BUCKET");
  });

  it("falls back receipts to medical bucket", () => {
    const r = resolveReceiptsBucket({
      SUPABASE_MEDICAL_VISITS_BUCKET: "medical-visit-certificates",
    });
    assert.equal(r.bucket, "medical-visit-certificates");
    assert.match(r.sourceEnv, /SUPABASE_MEDICAL_VISITS_BUCKET/);
  });

  it("defaults receipts to medical-visit-certificates", () => {
    const r = resolveReceiptsBucket({});
    assert.equal(r.bucket, "medical-visit-certificates");
  });
});

describe("path normalization", () => {
  it("normalizes receipt paths", () => {
    assert.equal(normalizeReceiptObjectPath("CN-000001.pdf"), "receipts/CN-000001.pdf");
    assert.equal(normalizeReceiptObjectPath("receipts/CN-000001.pdf"), "receipts/CN-000001.pdf");
    assert.equal(normalizeReceiptObjectPath("public/receipts/CN-000001.pdf"), "receipts/CN-000001.pdf");
  });
});

describe("storage pagination helper", () => {
  it("paginates names", () => {
    const pages = paginateNames(["a", "b", "c", "d", "e"], 2);
    assert.deepEqual(pages, [["a", "b"], ["c", "d"], ["e"]]);
  });
});

describe("file references", () => {
  const buckets = {
    enrollmentDocuments: "enrollment-documents",
    medicalCertificates: "medical-visit-certificates",
    receipts: "medical-visit-certificates",
    storageConfigured: true,
  };

  it("marks found supabase reference", () => {
    const supabaseObjects: StorageObjectRecord[] = [
      {
        bucket: "enrollment-documents",
        path: "pending/u1/parent_id_front-1.pdf",
        name: "parent_id_front-1.pdf",
        sizeBytes: 10,
        mimeType: "application/pdf",
        createdAt: null,
        updatedAt: null,
        etag: null,
        source: "SUPABASE",
        domain: "ENROLLMENT_DOCUMENT",
      },
    ];
    const result = matchFileReferences({
      db: {
        enrollmentDocuments: [{ id: "d1", filePath: "pending/u1/parent_id_front-1.pdf" }],
        medicalVisits: [],
        receipts: [],
      },
      buckets,
      supabaseObjects,
      localObjects: [],
    });
    assert.equal(result.references[0]?.status, "FOUND_SUPABASE");
  });

  it("marks missing enrollment document as blocking issue", () => {
    const result = matchFileReferences({
      db: {
        enrollmentDocuments: [{ id: "d1", filePath: "pending/u1/missing.pdf" }],
        medicalVisits: [],
        receipts: [],
      },
      buckets,
      supabaseObjects: [],
      localObjects: [],
    });
    assert.equal(result.references[0]?.status, "MISSING");
    assert.ok(result.issues.some((i) => i.code === "ENROLLMENT_DOCUMENT_FILE_MISSING" && i.severity === "BLOCKING"));
  });

  it("finds receipt in local fallback", () => {
    const result = matchFileReferences({
      db: {
        enrollmentDocuments: [],
        medicalVisits: [],
        receipts: [{ id: "r1", filePath: "receipts/CN-000001.pdf", receiptNumber: "CN-000001" }],
      },
      buckets,
      supabaseObjects: [],
      localObjects: [
        {
          bucket: "local",
          path: "public/receipts/CN-000001.pdf",
          name: "CN-000001.pdf",
          sizeBytes: 100,
          mimeType: null,
          createdAt: null,
          updatedAt: null,
          etag: null,
          source: "LOCAL",
          domain: "RECEIPT",
        },
      ],
    });
    assert.equal(result.references[0]?.status, "FOUND_LOCAL_FALLBACK");
  });

  it("flags unreferenced storage as warning", () => {
    const result = matchFileReferences({
      db: { enrollmentDocuments: [], medicalVisits: [], receipts: [] },
      buckets,
      supabaseObjects: [
        {
          bucket: "enrollment-documents",
          path: "pending/orphan.pdf",
          name: "orphan.pdf",
          sizeBytes: 1,
          mimeType: null,
          createdAt: null,
          updatedAt: null,
          etag: null,
          source: "SUPABASE",
          domain: "ENROLLMENT_DOCUMENT",
        },
      ],
      localObjects: [],
    });
    assert.equal(result.unreferencedStorage.length, 1);
    assert.ok(result.issues.some((i) => i.code === "STORAGE_UNREFERENCED_OBJECTS" && i.severity === "WARNING"));
  });
});

describe("duplicates helpers", () => {
  it("normalizes emails case-insensitively", () => {
    assert.equal(normalizeEmail("Foo@Bar.COM"), "foo@bar.com");
  });

  it("normalizes tax codes", () => {
    assert.equal(normalizeTaxCode(" rss mra 80a01 "), "RSSMRA80A01");
  });

  it("masks emails", () => {
    const masked = maskEmail("mario.rossi@example.com");
    assert.ok(!masked.includes("mario.rossi"));
    assert.ok(masked.includes("@"));
  });
});

describe("password classification", () => {
  it("accepts valid bcrypt", () => {
    const valid = "$2a$12$ABCDEFGHIJKLMNOPQRSTUV0123456789abcdefghijklmnopqrsTU";
    assert.equal(valid.length, 60);
    const c = classifyPasswordHash(valid);
    assert.equal(c.class, "BCRYPT_VALID_FORMAT");
    assert.equal(c.costFactor, 12);
  });

  it("detects malformed bcrypt", () => {
    const c = classifyPasswordHash("$2a$12$short");
    assert.equal(c.class, "BCRYPT_MALFORMED");
  });

  it("detects empty", () => {
    assert.equal(classifyPasswordHash("").class, "EMPTY_OR_NULL");
    assert.equal(classifyPasswordHash(null).class, "EMPTY_OR_NULL");
  });

  it("detects unknown and argon2", () => {
    assert.equal(classifyPasswordHash("not-a-hash").class, "UNKNOWN");
    assert.equal(classifyPasswordHash("$argon2id$v=19$m=65536,t=3,p=1$abc").class, "ARGON2");
  });

  it("summarizes reset required", () => {
    const summary = summarizePasswordHashes([
      { id: "1", passwordHash: "$2a$12$ABCDEFGHIJKLMNOPQRSTUV0123456789abcdefghijklmnopqrsTU" },
      { id: "2", passwordHash: "" },
      { id: "3", passwordHash: "$2a$12$bad" },
    ]);
    assert.equal(summary.bcryptImportable, 1);
    assert.equal(summary.emptyOrNull, 1);
    assert.equal(summary.bcryptMalformed, 1);
    assert.equal(summary.resetRequired, 2);
  });
});

describe("verdict", () => {
  it("READY_FOR_EXPORT", () => {
    const password = summarizePasswordHashes([
      { id: "1", passwordHash: "$2a$12$ABCDEFGHIJKLMNOPQRSTUV0123456789abcdefghijklmnopqrsTU" },
    ]);
    const v = computeVerdict({
      fundamentalReadable: true,
      storageInventoryFailed: false,
      issues: [],
      password,
    });
    assert.equal(v.verdict, "READY_FOR_EXPORT");
    assert.equal(v.exitCode, 0);
  });

  it("READY_FOR_EXPORT_WITH_WARNINGS", () => {
    const password = summarizePasswordHashes([
      { id: "1", passwordHash: "$2a$12$ABCDEFGHIJKLMNOPQRSTUV0123456789abcdefghijklmnopqrsTU" },
    ]);
    const v = computeVerdict({
      fundamentalReadable: true,
      storageInventoryFailed: false,
      issues: [{ code: "X", severity: "WARNING", message: "warn" }],
      password,
    });
    assert.equal(v.verdict, "READY_FOR_EXPORT_WITH_WARNINGS");
    assert.equal(v.exitCode, 0);
  });

  it("BLOCKED on malformed password", () => {
    const password = summarizePasswordHashes([{ id: "1", passwordHash: "$2a$12$bad" }]);
    const issues = passwordIssuesFromSummary(password);
    const v = computeVerdict({
      fundamentalReadable: true,
      storageInventoryFailed: false,
      issues,
      password,
    });
    assert.equal(v.verdict, "BLOCKED");
    assert.equal(v.exitCode, 1);
  });

  it("BLOCKED on fundamental unreadability", () => {
    const password = summarizePasswordHashes([]);
    const v = computeVerdict({
      fundamentalReadable: false,
      storageInventoryFailed: false,
      issues: [],
      password,
    });
    assert.equal(v.verdict, "BLOCKED");
  });
});

describe("report secrecy", () => {
  it("does not contain secrets in markdown for a synthetic report", () => {
    const password = summarizePasswordHashes([
      { id: "user-1", passwordHash: "$2a$12$ABCDEFGHIJKLMNOPQRSTUV0123456789abcdefghijklmnopqrsTU" },
    ]);
    const report: AuditReport = {
      generatedAt: "2026-07-28T00:00:00.000Z",
      verdict: "READY_FOR_EXPORT",
      exitCode: 0,
      environment: {
        database: { reachable: true, fundamentalReadable: true },
        storage: {
          configured: false,
          reachable: false,
          buckets: [],
          listErrors: [],
        },
      },
      counts: [{ model: "User", count: 1, status: "OK" }],
      password,
      issues: [],
      references: {
        total: 0,
        withPath: 0,
        withoutPath: 0,
        byStatus: {
          FOUND_SUPABASE: 0,
          FOUND_LOCAL_FALLBACK: 0,
          MISSING: 0,
          INVALID_PATH: 0,
          DUPLICATE_REFERENCE: 0,
          EMPTY_REFERENCE: 0,
          BUCKET_NOT_CONFIGURED: 0,
        },
        items: [],
      },
      storage: {
        objects: [],
        unreferencedCount: 0,
        duplicatePaths: [],
        zeroByteCount: 0,
        unexpectedExtensionCount: 0,
      },
      localFallbacks: { scannedDirs: [], objects: [], missingDirs: [] },
      summary: { blocking: 0, warning: 0, info: 0 },
    };
    const md = buildMarkdownReport(report);
    assert.equal(assertNoSecretsInText(md).length, 0);
    assert.ok(!md.includes("$2a$12$ABCDEFGHIJKLMNOPQRSTUV"));
  });
});

describe("cli args", () => {
  it("parses --out", () => {
    const opts = parseCliArgs(["--out", "./custom-audit"]);
    assert.ok(opts.outDir.replaceAll("\\", "/").endsWith("custom-audit"));
  });
});

describe("orphan payment/receipt detection via references logic", () => {
  it("empty receipt path is blocking", () => {
    const result = matchFileReferences({
      db: {
        enrollmentDocuments: [],
        medicalVisits: [],
        receipts: [{ id: "r1", filePath: null, receiptNumber: "CN-1" }],
      },
      buckets: {
        enrollmentDocuments: "enrollment-documents",
        medicalCertificates: "medical-visit-certificates",
        receipts: "medical-visit-certificates",
        storageConfigured: true,
      },
      supabaseObjects: [],
      localObjects: [],
    });
    assert.ok(result.issues.some((i) => i.code === "RECEIPT_FILE_EMPTY" && i.severity === "BLOCKING"));
  });
});
