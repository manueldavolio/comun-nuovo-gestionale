import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowsExternalPublication,
  allowsInternalUse,
  choiceImpliesGrant,
  computeMediaReviewStatus,
  parentVisibleMediaWhere,
  suspensionWarningForChoiceChange,
  type AthleteImageConsentState,
} from "./image-consent-policy";

function state(
  partial: Partial<AthleteImageConsentState> & Pick<AthleteImageConsentState, "athleteId">,
): AthleteImageConsentState {
  return {
    granted: false,
    choice: null,
    purpose: null,
    source: "none",
    recordedAt: null,
    documentVersion: null,
    legacyHistoricalOnly: false,
    ...partial,
  };
}

describe("image consent choices", () => {
  it("treats only GRANTED as consent", () => {
    assert.equal(choiceImpliesGrant("GRANTED"), true);
    assert.equal(choiceImpliesGrant("DENIED"), false);
    assert.equal(choiceImpliesGrant("DEFERRED"), false);
    assert.equal(choiceImpliesGrant(null), false);
  });

  it("warns when DEFERRED or DENIED replaces a prior grant", () => {
    assert.match(
      suspensionWarningForChoiceChange({ previousChoice: "GRANTED", nextChoice: "DEFERRED" }) ?? "",
      /sospesi/i,
    );
    assert.match(
      suspensionWarningForChoiceChange({ previousChoice: "GRANTED", nextChoice: "DENIED" }) ?? "",
      /sospesi/i,
    );
    assert.equal(
      suspensionWarningForChoiceChange({ previousChoice: "DENIED", nextChoice: "DEFERRED" }),
      null,
    );
  });
});

describe("purpose independence and legacy compatibility", () => {
  it("does not allow EXTERNAL publication from INTERNAL grant", () => {
    const internal = state({
      athleteId: "a1",
      purpose: "INTERNAL",
      choice: "GRANTED",
      granted: true,
      source: "event",
      documentVersion: "1.1",
    });
    assert.equal(allowsInternalUse(internal), true);
    assert.equal(allowsExternalPublication(internal), false);
  });

  it("does not convert legacy 1.0 into EXTERNAL publication rights", () => {
    const legacy = state({
      athleteId: "a1",
      granted: false,
      source: "legacy",
      legacyHistoricalOnly: true,
      documentVersion: "1.0",
      recordedAt: new Date(),
    });
    assert.equal(allowsExternalPublication(legacy), false);
    assert.equal(allowsInternalUse(legacy), false);
  });

  it("allows EXTERNAL only with EXTERNAL GRANTED 1.1-style state", () => {
    const external = state({
      athleteId: "a1",
      purpose: "EXTERNAL",
      choice: "GRANTED",
      granted: true,
      source: "event",
      documentVersion: "1.1",
    });
    assert.equal(allowsExternalPublication(external), true);
  });

  it("does not treat DEFERRED as EXTERNAL grant", () => {
    const deferred = state({
      athleteId: "a1",
      purpose: "EXTERNAL",
      choice: "DEFERRED",
      granted: false,
      source: "event",
      documentVersion: "1.1",
    });
    assert.equal(allowsExternalPublication(deferred), false);
  });
});

describe("media review status / group photos", () => {
  it("requires declared subjects before READY (no auto team authorization)", () => {
    assert.equal(
      computeMediaReviewStatus({
        subjectAthleteIds: [],
        subjectsDeclaredComplete: false,
        consentByAthleteId: new Map(),
      }),
      "NEEDS_REVIEW",
    );
  });

  it("blocks when any declared subject lacks EXTERNAL grant", () => {
    assert.equal(
      computeMediaReviewStatus({
        subjectAthleteIds: ["a1", "a2"],
        subjectsDeclaredComplete: true,
        consentByAthleteId: new Map([
          [
            "a1",
            state({
              athleteId: "a1",
              purpose: "EXTERNAL",
              choice: "GRANTED",
              granted: true,
              source: "event",
              documentVersion: "1.1",
            }),
          ],
          [
            "a2",
            state({
              athleteId: "a2",
              legacyHistoricalOnly: true,
              source: "legacy",
              documentVersion: "1.0",
            }),
          ],
        ]),
      }),
      "BLOCKED_CONSENT",
    );
  });

  it("is READY only when every declared subject has EXTERNAL GRANTED", () => {
    assert.equal(
      computeMediaReviewStatus({
        subjectAthleteIds: ["a1", "a2"],
        subjectsDeclaredComplete: true,
        consentByAthleteId: new Map([
          [
            "a1",
            state({
              athleteId: "a1",
              purpose: "EXTERNAL",
              choice: "GRANTED",
              granted: true,
              source: "event",
              documentVersion: "1.1",
            }),
          ],
          [
            "a2",
            state({
              athleteId: "a2",
              purpose: "EXTERNAL",
              choice: "GRANTED",
              granted: true,
              source: "event",
              documentVersion: "1.1",
            }),
          ],
        ]),
      }),
      "READY",
    );
  });
});

describe("parent visible media filter", () => {
  it("requires READY and published", () => {
    const where = parentVisibleMediaWhere();
    assert.equal(where.reviewStatus, "READY");
    assert.equal(where.subjectsDeclaredComplete, true);
    assert.ok(where.publishedAt);
  });
});
