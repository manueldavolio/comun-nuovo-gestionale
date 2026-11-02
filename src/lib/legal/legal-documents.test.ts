import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IMAGE_MEDIA_CONSENT_V1_BODY,
  PRIVACY_NOTICE_V1_BODY,
  SOCIETY_REGULATION_V1_BODY,
} from "./document-bodies";
import { sha256HexOfLegalDocumentBody } from "./hash";
import { buildEnrollmentConsentAuditFields, formatLegalPublicationDate } from "./consent-audit";

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
  it("stamps privacy+regulation always and image only when granted", () => {
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
    const image = {
      kind: "IMAGE_MEDIA_CONSENT" as const,
      version: "1.0",
      title: "i",
      bodyText: IMAGE_MEDIA_CONSENT_V1_BODY,
      contentSha256: sha256HexOfLegalDocumentBody(IMAGE_MEDIA_CONSENT_V1_BODY),
      effectiveFrom: null,
    };

    const withoutImage = buildEnrollmentConsentAuditFields({
      privacyNotice: privacy,
      regulation,
      imageConsentDoc: image,
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
      imageConsentDoc: image,
      imageConsentGranted: true,
      recordedAt,
    });
    assert.equal(withImage.imageConsentVersion, "1.0");
    assert.equal(withImage.imageConsentRecordedAt?.toISOString(), recordedAt.toISOString());
  });

  it("does not invent a publication date when effectiveFrom is null", () => {
    assert.match(formatLegalPublicationDate(null), /go-live/i);
  });
});
