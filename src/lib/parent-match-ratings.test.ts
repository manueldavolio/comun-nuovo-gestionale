import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildParentSeasonRatingSummary,
  decideParentAthleteRatingsAccess,
  formatParentRatingAverage,
  opponentLabelForParentRating,
} from "./parent-match-ratings";

describe("parent-match-ratings", () => {
  it("averages only rated matches and ignores empty score rows", () => {
    const summary = buildParentSeasonRatingSummary([
      {
        eventId: "e1",
        startAt: new Date("2026-09-01T10:00:00Z"),
        opponentName: "Virtus",
        title: "vs Virtus",
        possessionScore: 8,
        outOfPossessionScore: 6,
        attitudeScore: null,
        teamworkScore: null,
      },
      {
        eventId: "e2",
        startAt: new Date("2026-09-08T10:00:00Z"),
        opponentName: "Oratorio",
        title: "vs Oratorio",
        possessionScore: null,
        outOfPossessionScore: null,
        attitudeScore: null,
        teamworkScore: null,
      },
      {
        eventId: "e3",
        startAt: new Date("2026-09-15T10:00:00Z"),
        opponentName: null,
        title: "Amichevole",
        possessionScore: 7,
        outOfPossessionScore: 7,
        attitudeScore: 7,
        teamworkScore: 7,
      },
    ]);

    // e1 avg 7.0, e3 avg 7.0 → season 7.0; e2 excluded
    assert.equal(summary.ratedMatchCount, 2);
    assert.equal(summary.mediaVoti, 7);
    assert.equal(summary.matches[0]?.eventId, "e3");
    assert.equal(summary.matches[0]?.opponentLabel, "Amichevole");
    assert.equal(summary.matches[1]?.matchAverage, 7);
  });

  it("returns null media (not zero) when no ratings exist", () => {
    const summary = buildParentSeasonRatingSummary([]);
    assert.equal(summary.mediaVoti, null);
    assert.equal(summary.ratedMatchCount, 0);
    assert.equal(formatParentRatingAverage(null), "—");
    assert.equal(formatParentRatingAverage(7.5), "7.5");
  });

  it("does not invent opponent labels from empty data", () => {
    assert.equal(
      opponentLabelForParentRating({ opponentName: "  ", title: "  " }),
      "Partita",
    );
    assert.equal(
      opponentLabelForParentRating({ opponentName: "Paladina", title: "X" }),
      "Paladina",
    );
  });

  it("authorizes only associated PARENT accounts", () => {
    assert.deepEqual(
      decideParentAthleteRatingsAccess({
        authenticated: false,
        role: "PARENT",
        parentAssociatedToAthlete: true,
      }),
      { ok: false, status: 401 },
    );
    assert.deepEqual(
      decideParentAthleteRatingsAccess({
        authenticated: true,
        role: "COACH",
        parentAssociatedToAthlete: true,
      }),
      { ok: false, status: 403 },
    );
    assert.deepEqual(
      decideParentAthleteRatingsAccess({
        authenticated: true,
        role: "PARENT",
        parentAssociatedToAthlete: false,
      }),
      { ok: false, status: 403 },
    );
    assert.deepEqual(
      decideParentAthleteRatingsAccess({
        authenticated: true,
        role: "PARENT",
        parentAssociatedToAthlete: true,
      }),
      { ok: true },
    );
  });
});
