import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IMAGE_CONSENT_EXTERNAL_V1_1_BODY,
  IMAGE_CONSENT_INTERNAL_V1_1_BODY,
  PRIVACY_NOTICE_V1_BODY,
  SOCIETY_REGULATION_V1_BODY,
} from "./document-bodies";
import { sha256HexOfLegalDocumentBody } from "./hash";
import { buildEnrollmentConsentAuditFields, formatLegalPublicationDate } from "./consent-audit";
import { buildLegalDocumentSeedRows } from "./legal-document-seed";

describe("legal document hashing", () => {
  it("hashes are stable for canonical bodies", () => {
    assert.equal(
      sha256HexOfLegalDocumentBody(PRIVACY_NOTICE_V1_BODY),
      sha256HexOfLegalDocumentBody(PRIVACY_NOTICE_V1_BODY),
    );
    assert.notEqual(
      sha256HexOfLegalDocumentBody(PRIVACY_NOTICE_V1_BODY),
      sha256HexOfLegalDocumentBody(SOCIETY_REGULATION_V1_BODY),
    );
  });

  it("normalizes CRLF before hashing", () => {
    const lf = "line1\nline2";
    const crlf = "line1\r\nline2";
    assert.equal(sha256HexOfLegalDocumentBody(lf), sha256HexOfLegalDocumentBody(crlf));
  });
});

describe("enrollment consent audit builder", () => {
  it("stamps privacy+regulation always and image snapshot only when granted", () => {
    const recordedAt = new Date("2026-11-02T12:00:00.000Z");
    const privacy = {
      kind: "PRIVACY_NOTICE" as const,
      version: "1.0",
      title: "p",
      bodyText: PRIVACY_NOTICE_V1_BODY,
      contentSha256: sha256HexOfLegalDocumentBody(PRIVACY_NOTICE_V1_BODY),
      effectiveFrom: null,
    };
    const regulation = {
      kind: "SOCIETY_REGULATION" as const,
      version: "1.0",
      title: "r",
      bodyText: SOCIETY_REGULATION_V1_BODY,
      contentSha256: sha256HexOfLegalDocumentBody(SOCIETY_REGULATION_V1_BODY),
      effectiveFrom: null,
    };
    const imageExternal = {
      kind: "IMAGE_CONSENT_EXTERNAL" as const,
      version: "1.1",
      title: "ext",
      bodyText: IMAGE_CONSENT_EXTERNAL_V1_1_BODY,
      contentSha256: sha256HexOfLegalDocumentBody(IMAGE_CONSENT_EXTERNAL_V1_1_BODY),
      effectiveFrom: null,
    };

    const withoutImage = buildEnrollmentConsentAuditFields({
      privacyNotice: privacy,
      regulation,
      imageConsentDoc: imageExternal,
      imageConsentGranted: false,
      recordedAt,
    });
    assert.equal(withoutImage.consentAuditStatus, "COMPLETE");
    assert.equal(withoutImage.privacyNoticeVersion, "1.0");
    assert.equal(withoutImage.regulationVersion, "1.0");
    assert.equal(withoutImage.imageConsentVersion, null);
    assert.equal(withoutImage.imageConsentRecordedAt, null);

    const withImage = buildEnrollmentConsentAuditFields({
      privacyNotice: privacy,
      regulation,
      imageConsentDoc: imageExternal,
      imageConsentGranted: true,
      recordedAt,
    });
    assert.equal(withImage.imageConsentVersion, "1.1");
    assert.equal(withImage.imageConsentRecordedAt?.toISOString(), recordedAt.toISOString());
  });

  it("does not invent a publication date when effectiveFrom is null", () => {
    assert.match(formatLegalPublicationDate(null), /go-live/i);
  });
});

describe("legal document seed rows", () => {
  it("keeps privacy 1.0 and IMAGE_MEDIA_CONSENT 1.0 current; dual 1.1 catalog-only until activation", () => {
    const rows = buildLegalDocumentSeedRows(new Date("2026-11-02T12:00:00.000Z"));
    const byKind = Object.fromEntries(rows.map((row) => [row.kind, row]));

    assert.equal(byKind.PRIVACY_NOTICE?.version, "1.0");
    assert.equal(byKind.PRIVACY_NOTICE?.isCurrent, true);
    assert.equal(byKind.IMAGE_MEDIA_CONSENT?.version, "1.0");
    assert.equal(byKind.IMAGE_MEDIA_CONSENT?.isCurrent, true);
    assert.equal(byKind.IMAGE_CONSENT_INTERNAL?.version, "1.1");
    assert.equal(byKind.IMAGE_CONSENT_INTERNAL?.isCurrent, false);
    assert.equal(byKind.IMAGE_CONSENT_EXTERNAL?.version, "1.1");
    assert.equal(byKind.IMAGE_CONSENT_EXTERNAL?.isCurrent, false);
    assert.equal(byKind.IMAGE_CONSENT_INTERNAL?.effectiveFrom, null);
    assert.equal(byKind.IMAGE_CONSENT_EXTERNAL?.effectiveFrom, null);
    assert.ok(String(byKind.IMAGE_CONSENT_INTERNAL?.bodyText).includes("USO INTERNO"));
    assert.ok(String(byKind.IMAGE_CONSENT_EXTERNAL?.bodyText).includes("PUBBLICAZIONE ESTERNA"));
    assert.ok(IMAGE_CONSENT_INTERNAL_V1_1_BODY.includes("DECIDERÒ PIÙ AVANTI"));
  });
});
