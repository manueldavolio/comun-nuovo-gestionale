import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClassicMatchResultPayload,
  clubOpponentGoalsFromHomeAway,
  computeFourPeriodBreakdown,
  countEnteredPeriods,
  formatPeriodScoresDetail,
  isFourPeriodResultComplete,
  periodPointsFromClubGoals,
  resolveEventScoresFromPeriods,
  shouldShowSoftStatsHintFromRealGoals,
  usesFourPeriodScoring,
} from "./four-period-scoring";
import { updateAttendanceSchema } from "./validation/attendance";

describe("usesFourPeriodScoring", () => {
  it("recognizes Pulcini variants", () => {
    assert.equal(usesFourPeriodScoring("Pulcini"), true);
    assert.equal(usesFourPeriodScoring("Pulcini 2016"), true);
    assert.equal(usesFourPeriodScoring("Pulcini 2016/2017"), true);
    assert.equal(usesFourPeriodScoring({ name: "pulcini 2017" }), true);
  });

  it("recognizes Esordienti variants", () => {
    assert.equal(usesFourPeriodScoring("Esordienti"), true);
    assert.equal(usesFourPeriodScoring("Esordienti U15"), true);
    assert.equal(usesFourPeriodScoring("Esordienti 2014"), true);
    assert.equal(usesFourPeriodScoring("Esordienti 2014/2015"), true);
  });

  it("excludes normal categories", () => {
    assert.equal(usesFourPeriodScoring("Juniores"), false);
    assert.equal(usesFourPeriodScoring("Allievi"), false);
    assert.equal(usesFourPeriodScoring("Primi Calci"), false);
    assert.equal(usesFourPeriodScoring("Gioco Sport"), false);
    assert.equal(usesFourPeriodScoring("Scuola Calcio"), false);
    assert.equal(usesFourPeriodScoring(""), false);
    assert.equal(usesFourPeriodScoring(null), false);
  });
});

describe("four-period point math", () => {
  it("1-0 / 1-0 / 1-0 / 0-10 → finale 3-1, gol reali CN 3", () => {
    const result = computeFourPeriodBreakdown(
      [
        { periodNumber: 1, homeScore: 1, awayScore: 0 },
        { periodNumber: 2, homeScore: 1, awayScore: 0 },
        { periodNumber: 3, homeScore: 1, awayScore: 0 },
        { periodNumber: 4, homeScore: 0, awayScore: 10 },
      ],
      true,
    );
    assert.equal(result.complete, true);
    assert.equal(result.finalClubPoints, 3);
    assert.equal(result.finalOpponentPoints, 1);
    assert.equal(result.realClubGoals, 3);
    assert.equal(result.realOpponentGoals, 10);
  });

  it("four draws → finale 4-4", () => {
    const result = computeFourPeriodBreakdown(
      [
        { periodNumber: 1, homeScore: 2, awayScore: 2 },
        { periodNumber: 2, homeScore: 0, awayScore: 0 },
        { periodNumber: 3, homeScore: 1, awayScore: 1 },
        { periodNumber: 4, homeScore: 3, awayScore: 3 },
      ],
      true,
    );
    assert.equal(result.finalClubPoints, 4);
    assert.equal(result.finalOpponentPoints, 4);
  });

  it("5-0 / 5-0 / 5-0 / 0-1 → finale 3-1 e gol reali CN = 15", () => {
    const result = computeFourPeriodBreakdown(
      [
        { periodNumber: 1, homeScore: 5, awayScore: 0 },
        { periodNumber: 2, homeScore: 5, awayScore: 0 },
        { periodNumber: 3, homeScore: 5, awayScore: 0 },
        { periodNumber: 4, homeScore: 0, awayScore: 1 },
      ],
      true,
    );
    assert.equal(result.finalClubPoints, 3);
    assert.equal(result.finalOpponentPoints, 1);
    assert.equal(result.realClubGoals, 15);
    assert.equal(result.realOpponentGoals, 1);
  });

  it("missing one period → incomplete", () => {
    assert.equal(
      isFourPeriodResultComplete([
        { periodNumber: 1, homeScore: 1, awayScore: 0 },
        { periodNumber: 2, homeScore: 0, awayScore: 0 },
        { periodNumber: 3, homeScore: 2, awayScore: 2 },
        { periodNumber: 4, homeScore: null, awayScore: null },
      ]),
      false,
    );
  });

  it("explicit 0-0 period is valid", () => {
    assert.equal(
      isFourPeriodResultComplete([
        { periodNumber: 1, homeScore: 1, awayScore: 0 },
        { periodNumber: 2, homeScore: 0, awayScore: 0 },
        { periodNumber: 3, homeScore: 2, awayScore: 2 },
        { periodNumber: 4, homeScore: 1, awayScore: 0 },
      ]),
      true,
    );
    assert.deepEqual(periodPointsFromClubGoals(0, 0), { clubPoints: 1, opponentPoints: 1 });
  });

  it("home/away mapping for club goals when away", () => {
    // Comun Nuovo in trasferta: home=avversario 2, away=CN 1 → CN 1 gol, avversario 2
    assert.deepEqual(
      clubOpponentGoalsFromHomeAway({ homeScore: 2, awayScore: 1, isHome: false }),
      { clubGoals: 1, opponentGoals: 2 },
    );
    const result = computeFourPeriodBreakdown(
      [
        { periodNumber: 1, homeScore: 0, awayScore: 1 }, // opp 0 - CN 1 → CN win
        { periodNumber: 2, homeScore: 0, awayScore: 1 },
        { periodNumber: 3, homeScore: 0, awayScore: 1 },
        { periodNumber: 4, homeScore: 10, awayScore: 0 }, // opp 10 - CN 0 → CN loss
      ],
      false,
    );
    assert.equal(result.finalClubPoints, 3);
    assert.equal(result.finalOpponentPoints, 1);
    assert.equal(result.realClubGoals, 3);
    assert.equal(result.realOpponentGoals, 10);
  });

  it("soft hint uses real goals not period points", () => {
    assert.equal(
      shouldShowSoftStatsHintFromRealGoals({ realClubGoals: 15, playerGoalsSum: 0 }),
      true,
    );
    assert.equal(
      shouldShowSoftStatsHintFromRealGoals({ realClubGoals: 3, playerGoalsSum: 3 }),
      false,
    );
    assert.equal(
      shouldShowSoftStatsHintFromRealGoals({ realClubGoals: 0, playerGoalsSum: 0 }),
      false,
    );
  });
});

describe("classic match result payload null vs 0-0", () => {
  it("null/null + only attendances → omits scores", () => {
    const payload = buildClassicMatchResultPayload({
      resultEntered: false,
      clubScore: 0,
      opponentScore: 0,
      isHome: true,
      opponentName: "Paladina",
    });
    assert.equal("homeScore" in payload, false);
    assert.equal("awayScore" in payload, false);

    const parsed = updateAttendanceSchema.safeParse({
      entries: [{ athleteId: "clxxxxxxxxxxxxxxxxxxxx", status: "PRESENT" }],
      matchResult: payload,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.matchResult?.homeScore, undefined);
      assert.equal(parsed.data.matchResult?.awayScore, undefined);
    }
  });

  it("confirm 0-0 → sends 0/0", () => {
    const payload = buildClassicMatchResultPayload({
      resultEntered: true,
      clubScore: 0,
      opponentScore: 0,
      isHome: true,
      opponentName: "Paladina",
    });
    assert.deepEqual(
      { homeScore: payload.homeScore, awayScore: payload.awayScore },
      { homeScore: 0, awayScore: 0 },
    );
  });

  it("2-1 home and away mapping", () => {
    assert.deepEqual(
      buildClassicMatchResultPayload({
        resultEntered: true,
        clubScore: 2,
        opponentScore: 1,
        isHome: true,
        opponentName: "X",
      }),
      { opponentName: "X", isHome: true, homeScore: 2, awayScore: 1 },
    );
    assert.deepEqual(
      buildClassicMatchResultPayload({
        resultEntered: true,
        clubScore: 2,
        opponentScore: 1,
        isHome: false,
        opponentName: "X",
      }),
      { opponentName: "X", isHome: false, homeScore: 1, awayScore: 2 },
    );
  });

  it("existing 3-2 remains when still entered", () => {
    const payload = buildClassicMatchResultPayload({
      resultEntered: true,
      clubScore: 3,
      opponentScore: 2,
      isHome: true,
      opponentName: "Paladina",
    });
    assert.equal(payload.homeScore, 3);
    assert.equal(payload.awayScore, 2);
  });
});

describe("dual-write Event scores from periods", () => {
  const four = [
    { periodNumber: 1, homeScore: 1, awayScore: 0 },
    { periodNumber: 2, homeScore: 1, awayScore: 0 },
    { periodNumber: 3, homeScore: 1, awayScore: 0 },
    { periodNumber: 4, homeScore: 0, awayScore: 10 },
  ];

  it("3/4 periods → Event scores null", () => {
    const partial = [
      ...four.slice(0, 3),
      { periodNumber: 4, homeScore: null, awayScore: null },
    ];
    const resolved = resolveEventScoresFromPeriods(partial, true);
    assert.equal(resolved.homeScore, null);
    assert.equal(resolved.awayScore, null);
    assert.equal(countEnteredPeriods(partial), 3);
  });

  it("4/4 → Event 3-1 home punti-tempo", () => {
    const resolved = resolveEventScoresFromPeriods(four, true);
    assert.deepEqual(
      { homeScore: resolved.homeScore, awayScore: resolved.awayScore },
      { homeScore: 3, awayScore: 1 },
    );
  });

  it("4/4 away → Event home/away swapped for punti-tempo", () => {
    // When away, period rows still store home=venue home. Example CN away scoring 3-1 on points:
    // periods as venue-home = opponent, so CN goals on awayScore side.
    const awayPeriods = [
      { periodNumber: 1, homeScore: 0, awayScore: 1 },
      { periodNumber: 2, homeScore: 0, awayScore: 1 },
      { periodNumber: 3, homeScore: 0, awayScore: 1 },
      { periodNumber: 4, homeScore: 10, awayScore: 0 },
    ];
    const resolved = resolveEventScoresFromPeriods(awayPeriods, false);
    assert.deepEqual(
      { homeScore: resolved.homeScore, awayScore: resolved.awayScore },
      { homeScore: 1, awayScore: 3 },
    );
  });

  it("formatPeriodScoresDetail only when complete", () => {
    assert.equal(formatPeriodScoresDetail(four, true), "1-0 · 1-0 · 1-0 · 0-10");
    assert.equal(
      formatPeriodScoresDetail(
        [...four.slice(0, 3), { periodNumber: 4, homeScore: null, awayScore: null }],
        true,
      ),
      null,
    );
  });
});

describe("periodScores validation", () => {
  it("rejects periodNumber outside 1..4", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [{ athleteId: "clxxxxxxxxxxxxxxxxxxxx", status: "PRESENT" }],
      periodScores: [{ periodNumber: 5, homeScore: 1, awayScore: 0 }],
    });
    assert.equal(parsed.success, false);
  });

  it("rejects negative scores", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [{ athleteId: "clxxxxxxxxxxxxxxxxxxxx", status: "PRESENT" }],
      periodScores: [{ periodNumber: 1, homeScore: -1, awayScore: 0 }],
    });
    assert.equal(parsed.success, false);
  });

  it("rejects duplicate periodNumber", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [{ athleteId: "clxxxxxxxxxxxxxxxxxxxx", status: "PRESENT" }],
      periodScores: [
        { periodNumber: 1, homeScore: 1, awayScore: 0 },
        { periodNumber: 1, homeScore: 0, awayScore: 0 },
      ],
    });
    assert.equal(parsed.success, false);
  });

  it("accepts null/null period as not entered", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [{ athleteId: "clxxxxxxxxxxxxxxxxxxxx", status: "PRESENT" }],
      periodScores: [{ periodNumber: 1, homeScore: null, awayScore: null }],
    });
    assert.equal(parsed.success, true);
  });
});
