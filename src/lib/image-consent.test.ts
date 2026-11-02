import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeMediaReviewStatus, parentVisibleMediaWhere } from "./image-consent-policy";

describe("media review status", () => {
  it("requires declared subjects before READY", () => {
    assert.equal(
      computeMediaReviewStatus({
        subjectAthleteIds: [],
        subjectsDeclaredComplete: false,
        consentByAthleteId: new Map(),
      }),
      "NEEDS_REVIEW",
    );
  });

  it("blocks when a declared subject lacks consent", () => {
    assert.equal(
      computeMediaReviewStatus({
        subjectAthleteIds: ["a1", "a2"],
        subjectsDeclaredComplete: true,
        consentByAthleteId: new Map([
          [
            "a1",
            {
              athleteId: "a1",
              granted: true,
              source: "event",
              recordedAt: new Date(),
              documentVersion: "1.0",
            },
          ],
          [
            "a2",
            {
              athleteId: "a2",
              granted: false,
              source: "none",
              recordedAt: null,
              documentVersion: null,
            },
          ],
        ]),
      }),
      "BLOCKED_CONSENT",
    );
  });

  it("is READY only when all declared subjects consented", () => {
    assert.equal(
      computeMediaReviewStatus({
        subjectAthleteIds: ["a1"],
        subjectsDeclaredComplete: true,
        consentByAthleteId: new Map([
          [
            "a1",
            {
              athleteId: "a1",
              granted: true,
              source: "enrollment",
              recordedAt: new Date(),
              documentVersion: "1.0",
            },
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
