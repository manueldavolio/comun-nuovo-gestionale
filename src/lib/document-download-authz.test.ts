import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Guardrail IDOR: le route di download sensibili devono verificare associazione genitore
 * (o ruolo admin/YD) prima di leggere storage.
 */
describe("document download authorization source guards", () => {
  const root = process.cwd();

  it("parent medical certificate download asserts association", () => {
    const source = readFileSync(
      path.join(
        root,
        "src/app/api/genitore/medical-visits/[medicalVisitId]/certificate/download/route.ts",
      ),
      "utf8",
    );
    assert.match(source, /assertUserParentAssociatedToAthlete/);
    assert.match(source, /role !== "PARENT"/);
    assert.match(source, /recordSensitiveDocumentAccessRequired/);
  });

  it("admin medical certificate download excludes COACH and YOUTH_DIRECTOR", () => {
    const source = readFileSync(
      path.join(
        root,
        "src/app/api/admin/medical-visits/[medicalVisitId]/certificate/download/route.ts",
      ),
      "utf8",
    );
    assert.match(source, /role !== "ADMIN"/);
    assert.match(source, /recordSensitiveDocumentAccessRequired/);
    assert.doesNotMatch(source, /YOUTH_DIRECTOR/);
  });

  it("parent enrollment document download asserts association", () => {
    const source = readFileSync(
      path.join(
        root,
        "src/app/api/genitore/enrollment-documents/[documentId]/download/route.ts",
      ),
      "utf8",
    );
    assert.match(source, /assertUserParentAssociatedToAthlete/);
    assert.match(source, /role !== "PARENT"/);
  });

  it("admin enrollment identity download is ADMIN-only (not YOUTH_DIRECTOR)", () => {
    const source = readFileSync(
      path.join(
        root,
        "src/app/api/admin/enrollment-documents/[documentId]/download/route.ts",
      ),
      "utf8",
    );
    assert.match(source, /decideStaffEnrollmentIdentityDocumentDownload/);
    assert.doesNotMatch(
      source,
      /session\.user\.role !== "ADMIN" && session\.user\.role !== "YOUTH_DIRECTOR"/,
    );
  });

  it("parent receipt download asserts primary parent", () => {
    const source = readFileSync(
      path.join(root, "src/app/api/genitore/receipts/[receiptId]/download/route.ts"),
      "utf8",
    );
    assert.match(source, /assertUserPrimaryParentOfAthlete/);
  });

  it("enrollment pending paths are ownership-scoped", () => {
    const source = readFileSync(
      path.join(root, "src/lib/enrollment-documents.ts"),
      "utf8",
    );
    assert.match(source, /pending\/\$\{/);
    assert.match(source, /assertOwnedPendingEnrollmentDocumentPath/);
  });
});
