import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowsExternalPublication,
  choiceImpliesGrant,
  computeMediaReviewStatus,
  suspensionWarningForChoiceChange,
  type AthleteImageConsentState,
} from "@/lib/image-consent-policy";

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

describe("activation-safe publication rules", () => {
  it("never treats DEFERRED or DENIED as publication consent", () => {
    assert.equal(choiceImpliesGrant("DEFERRED"), false);
    assert.equal(choiceImpliesGrant("DENIED"), false);
    assert.equal(
      allowsExternalPublication(
        state({
          athleteId: "a1",
          purpose: "EXTERNAL",
          choice: "DEFERRED",
          granted: false,
          source: "event",
          documentVersion: "1.1",
        }),
      ),
      false,
    );
    assert.equal(
      allowsExternalPublication(
        state({
          athleteId: "a1",
          purpose: "EXTERNAL",
          choice: "DENIED",
          granted: false,
          source: "event",
          documentVersion: "1.1",
        }),
      ),
      false,
    );
  });

  it("blocks group publication if any subject lacks EXTERNAL grant", () => {
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
              choice: "DEFERRED",
              granted: false,
              source: "event",
              documentVersion: "1.1",
            }),
          ],
        ]),
      }),
      "BLOCKED_CONSENT",
    );
  });

  it("does not treat historical-only 1.0 as publication grant after dual activation semantics", () => {
    assert.equal(
      allowsExternalPublication(
        state({
          athleteId: "a1",
          source: "legacy",
          legacyHistoricalOnly: true,
          documentVersion: "1.0",
          recordedAt: new Date(),
        }),
      ),
      false,
    );
  });

  it("warns when revoking or deferring a prior GRANTED choice", () => {
    assert.match(
      suspensionWarningForChoiceChange({ previousChoice: "GRANTED", nextChoice: "DENIED" }) ?? "",
      /sospesi/i,
    );
    assert.match(
      suspensionWarningForChoiceChange({ previousChoice: "GRANTED", nextChoice: "DEFERRED" }) ?? "",
      /DECIDERÒ PIÙ AVANTI/i,
    );
  });
});
