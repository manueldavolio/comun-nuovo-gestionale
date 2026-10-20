import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  averagePresentScores,
  computeCriterionSeasonAverages,
  hasAnyScore,
  normalizeMatchRatingScores,
} from "./match-player-rating";

describe("match-player-rating", () => {
  it("ignores null scores in average (never auto-zero)", () => {
    assert.equal(
      averagePresentScores({
        possessionScore: 8,
        outOfPossessionScore: null,
        attitudeScore: 6,
        teamworkScore: null,
      }),
      7,
    );
    assert.equal(
      averagePresentScores({
        possessionScore: null,
        outOfPossessionScore: null,
        attitudeScore: null,
        teamworkScore: null,
      }),
      null,
    );
  });

  it("rejects out-of-range scores", () => {
    const bad = normalizeMatchRatingScores({
      possessionScore: 11,
      outOfPossessionScore: null,
      attitudeScore: null,
      teamworkScore: null,
    });
    assert.equal(bad.ok, false);
  });

  it("computes seasonal criterion averages", () => {
    const averages = computeCriterionSeasonAverages([
      {
        possessionScore: 8,
        outOfPossessionScore: 6,
        attitudeScore: 7,
        teamworkScore: 7,
      },
      {
        possessionScore: 6,
        outOfPossessionScore: null,
        attitudeScore: 7,
        teamworkScore: null,
      },
    ]);
    assert.equal(averages.possession, 7);
    assert.equal(averages.attitude, 7);
    assert.equal(averages.outOfPossession, 6);
    assert.ok(averages.overall != null);
  });

  it("hasAnyScore", () => {
    assert.equal(
      hasAnyScore({
        possessionScore: null,
        outOfPossessionScore: null,
        attitudeScore: null,
        teamworkScore: null,
      }),
      false,
    );
    assert.equal(
      hasAnyScore({
        possessionScore: 5,
        outOfPossessionScore: null,
        attitudeScore: null,
        teamworkScore: null,
      }),
      true,
    );
  });

  it("optional votes never become zero in match average", () => {
    const avg = averagePresentScores({
      possessionScore: 10,
      outOfPossessionScore: null,
      attitudeScore: null,
      teamworkScore: null,
    });
    assert.equal(avg, 10);
  });
});
