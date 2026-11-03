import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enrollmentSchemaDualImage,
  enrollmentSchemaLegacyImage,
} from "./enrollment";

const SHOWN_PRIVACY_SHA =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const baseValidEnrollment = {
  athleteFirstName: "Mario",
  athleteLastName: "Rossi",
  athleteGender: "MALE" as const,
  athleteBirthDate: "2015-05-10",
  athleteBirthPlace: "Bergamo",
  athleteTaxCode: "RSSMRA15E10A794X",
  athleteNationality: "Italiana",
  athleteAddress: "Via Roma 1",
  athleteCity: "Comun Nuovo",
  athletePostalCode: "24040",
  athleteProvince: "BG",
  receiptFirstName: "Luigi",
  receiptLastName: "Rossi",
  receiptTaxCode: "RSSLGU80A01A794Y",
  receiptPhone: "+39 333 1234567",
  receiptAddress: "Via Roma 1",
  receiptCity: "Comun Nuovo",
  receiptPostalCode: "24040",
  receiptProvince: "BG",
  receiptEmail: "genitore@example.com",
  categoryId: "cat-1",
  seasonLabel: "2026/2027",
  privacyConsent: true,
  shownPrivacyNoticeVersion: "1.0",
  shownPrivacyNoticeContentSha256: SHOWN_PRIVACY_SHA,
  regulationConsent: true,
};

describe("enrollment privacy vs image consent validation", () => {
  it("requires privacy acknowledgement checkbox before submit", () => {
    const parsed = enrollmentSchemaLegacyImage.safeParse({
      ...baseValidEnrollment,
      privacyConsent: false,
      imageConsent: false,
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.match(
        parsed.error.issues.map((issue) => issue.message).join(" "),
        /informativa privacy/i,
      );
    }
  });

  it("allows enrollment when image consent is refused (legacy)", () => {
    const parsed = enrollmentSchemaLegacyImage.safeParse({
      ...baseValidEnrollment,
      imageConsent: false,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.imageConsent, false);
      assert.equal(parsed.data.privacyConsent, true);
    }
  });

  it("allows dual DENIED/DEFERRED image choices without blocking enrollment", () => {
    const parsed = enrollmentSchemaDualImage.safeParse({
      ...baseValidEnrollment,
      imageConsentInternal: "DENIED",
      imageConsentExternal: "DEFERRED",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.imageConsentInternal, "DENIED");
      assert.equal(parsed.data.imageConsentExternal, "DEFERRED");
      assert.equal(parsed.data.privacyConsent, true);
    }
  });
});
