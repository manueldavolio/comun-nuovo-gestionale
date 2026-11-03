import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  archiveDocumentPathErrorMessage,
  validateArchiveDocumentFilePath,
} from "./archive-document-path";
import {
  canStaffDownloadEnrollmentIdentityDocuments,
  decideStaffEnrollmentIdentityDocumentDownload,
} from "./enrollment-document-access-policy";
import {
  enrollmentDocumentPathErrorMessage,
  validateEnrollmentDocumentStoragePath,
} from "./enrollment-document-path";
import { upsertDocumentSchema } from "./validation/documents";
import { decideAdminOnlyEnrollmentIdentityDownload } from "./youth-director-route-gates";

describe("enrollment document storage path validation", () => {
  it("accepts existing pending and canonical paths", () => {
    const pending = validateEnrollmentDocumentStoragePath(
      "pending/cluser123abc/athlete_id_front-1793637594133-doc.pdf",
    );
    assert.equal(pending.ok, true);
    if (pending.ok) assert.equal(pending.kind, "pending");

    const canonical = validateEnrollmentDocumentStoragePath(
      "enrollment-documents/enr1/parent_id_front-1-id.jpg",
    );
    assert.equal(canonical.ok, true);
    if (canonical.ok) assert.equal(canonical.kind, "canonical");
  });

  it("rejects traversal, external URLs and absolute paths", () => {
    const cases = [
      "../etc/passwd",
      "pending/../secret.pdf",
      "https://evil.example/x.pdf",
      "http://cdn.example/doc.pdf",
      "/var/data/doc.pdf",
      "pending/",
      "other-prefix/file.pdf",
      "",
    ];
    for (const filePath of cases) {
      const result = validateEnrollmentDocumentStoragePath(filePath);
      assert.equal(result.ok, false, `expected reject: ${filePath}`);
      if (!result.ok) {
        assert.ok(enrollmentDocumentPathErrorMessage(result.code).length > 0);
      }
    }
  });
});

describe("archive document filePath validation", () => {
  it("allows relative placeholders and rejects public URLs", () => {
    assert.equal(
      validateArchiveDocumentFilePath("manual-placeholder/documenti_placeholder.pdf").ok,
      true,
    );
    assert.equal(validateArchiveDocumentFilePath("https://storage.example/doc.pdf").ok, false);
    assert.equal(validateArchiveDocumentFilePath("../../etc/passwd").ok, false);

    const parsed = upsertDocumentSchema.safeParse({
      athleteId: "cmg1athlete000000000000001",
      type: "ID_CARD",
      title: "CI",
      filePath: "https://public.example/id.pdf",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join(" ");
      assert.ok(
        /URL|estern|FilePath|Atleta/i.test(messages),
        messages,
      );
    }
    assert.match(archiveDocumentPathErrorMessage("EXTERNAL_URL"), /URL/);
  });
});

describe("staff enrollment identity download roles", () => {
  it("allows ADMIN and denies YOUTH_DIRECTOR / PARENT / COACH", () => {
    assert.equal(
      decideStaffEnrollmentIdentityDocumentDownload({
        authenticated: true,
        role: "ADMIN",
      }).allow,
      true,
    );
    assert.equal(canStaffDownloadEnrollmentIdentityDocuments("ADMIN"), true);

    for (const role of ["YOUTH_DIRECTOR", "PARENT", "COACH"]) {
      const decision = decideStaffEnrollmentIdentityDocumentDownload({
        authenticated: true,
        role,
      });
      assert.equal(decision.allow, false, role);
      if (!decision.allow) assert.equal(decision.status, 403);
      assert.equal(canStaffDownloadEnrollmentIdentityDocuments(role), false);
    }

    const anon = decideStaffEnrollmentIdentityDocumentDownload({
      authenticated: false,
      role: null,
    });
    assert.equal(anon.allow, false);
    if (!anon.allow) assert.equal(anon.status, 401);

    assert.equal(
      decideAdminOnlyEnrollmentIdentityDownload({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
      }).ok,
      false,
    );
    assert.equal(
      decideAdminOnlyEnrollmentIdentityDownload({
        authenticated: true,
        role: "ADMIN",
      }).ok,
      true,
    );
  });
});

describe("download route authz source guards (FASE 2)", () => {
  const root = process.cwd();

  it("admin enrollment download is ADMIN-only and audits access", () => {
    const source = readFileSync(
      path.join(
        root,
        "src/app/api/admin/enrollment-documents/[documentId]/download/route.ts",
      ),
      "utf8",
    );
    assert.match(source, /decideStaffEnrollmentIdentityDocumentDownload/);
    assert.match(source, /recordSensitiveDocumentAccessRequired/);
    assert.match(source, /SensitiveDocumentAccessLogError/);
    assert.match(source, /assertCanAccessEnrollmentDocumentData/);
    assert.doesNotMatch(source, /role !== "ADMIN" && session\.user\.role !== "YOUTH_DIRECTOR"/);
  });

  it("parent enrollment download keeps association check and audits", () => {
    const source = readFileSync(
      path.join(
        root,
        "src/app/api/genitore/enrollment-documents/[documentId]/download/route.ts",
      ),
      "utf8",
    );
    assert.match(source, /assertUserParentAssociatedToAthlete/);
    assert.match(source, /recordSensitiveDocumentAccessRequired/);
    assert.match(source, /SensitiveDocumentAccessLogError/);
    assert.match(source, /role !== "PARENT"/);
  });

  it("storage read validates path before download", () => {
    const source = readFileSync(path.join(root, "src/lib/enrollment-documents.ts"), "utf8");
    assert.match(source, /validateEnrollmentDocumentStoragePath/);
  });
});
