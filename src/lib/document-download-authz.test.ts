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
