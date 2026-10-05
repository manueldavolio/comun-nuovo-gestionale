import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clubGoalsFromResult,
  clampStepperValue,
  normalizeStatsForStatus,
  resolveIncompleteReasons,
  selectIncompleteMatches,
  shouldShowSoftStatsHint,
  softStatsHintForCompleteMatch,
  stepValue,
  type IncompleteMatchCandidate,
} from "./mister-incomplete";
import { buildMisterWeekTimeline, wallClockWeekBounds } from "./mister-week";
import { nowAsEuropeRomeWallClockUtc } from "./date-input";

function match(partial: Partial<IncompleteMatchCandidate> & { id: string }): IncompleteMatchCandidate {
  return {
    type: "LEAGUE_MATCH",
    title: "Comun Nuovo - Paladina",
    startAt: new Date(Date.UTC(2026, 9, 4, 15, 0, 0)),
    endAt: new Date(Date.UTC(2026, 9, 4, 17, 0, 0)),
    categoryId: "cat-a",
    opponentName: "Paladina",
    homeScore: null,
    awayScore: null,
    isHome: true,
    attendanceCount: 0,
    playerGoalsSum: 0,
    ...partial,
  };
}

describe("mister incomplete matches", () => {
  const wallNow = new Date(Date.UTC(2026, 9, 5, 12, 0, 0));

  it("marks match complete when attendance and 0-0 result exist", () => {
    const reasons = resolveIncompleteReasons({
      attendanceCount: 12,
      homeScore: 0,
      awayScore: 0,
    });
    assert.deepEqual(reasons, []);
  });

  it("marks missing result when scores are null", () => {
    const reasons = resolveIncompleteReasons({
      attendanceCount: 10,
      homeScore: null,
      awayScore: null,
    });
    assert.deepEqual(reasons, ["MISSING_RESULT"]);
  });

  it("marks missing attendance when count is 0", () => {
    const reasons = resolveIncompleteReasons({
      attendanceCount: 0,
      homeScore: 2,
      awayScore: 1,
    });
    assert.deepEqual(reasons, ["MISSING_ATTENDANCE"]);
  });

  it("selects incomplete matches within 21 days, excludes older and unauthorized categories", () => {
    const rows = selectIncompleteMatches(
      [
        match({
          id: "recent-incomplete",
          startAt: new Date(Date.UTC(2026, 9, 4, 15, 0, 0)),
          attendanceCount: 0,
          homeScore: null,
          awayScore: null,
        }),
        match({
          id: "complete-00",
          startAt: new Date(Date.UTC(2026, 9, 3, 15, 0, 0)),
          attendanceCount: 11,
          homeScore: 0,
          awayScore: 0,
        }),
        match({
          id: "too-old",
          startAt: new Date(Date.UTC(2026, 8, 1, 15, 0, 0)),
          attendanceCount: 0,
        }),
        match({
          id: "other-cat",
          categoryId: "cat-b",
          startAt: new Date(Date.UTC(2026, 9, 2, 15, 0, 0)),
          attendanceCount: 0,
        }),
        match({
          id: "training",
          type: "TRAINING",
          startAt: new Date(Date.UTC(2026, 9, 4, 18, 0, 0)),
          attendanceCount: 0,
        }),
        match({
          id: "future",
          startAt: new Date(Date.UTC(2026, 9, 10, 15, 0, 0)),
          endAt: new Date(Date.UTC(2026, 9, 10, 17, 0, 0)),
          attendanceCount: 0,
        }),
      ],
      { allowedCategoryIds: ["cat-a"], wallNow },
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "recent-incomplete");
    assert.deepEqual(rows[0]?.reasons, ["MISSING_ATTENDANCE", "MISSING_RESULT"]);
  });

  it("orders most recent first and caps at maxItems", () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      match({
        id: `m-${index}`,
        startAt: new Date(Date.UTC(2026, 9, 4 - index, 15, 0, 0)),
        attendanceCount: 0,
      }),
    );
    const rows = selectIncompleteMatches(candidates, {
      allowedCategoryIds: ["cat-a"],
      wallNow,
      maxItems: 8,
    });
    assert.equal(rows.length, 8);
    assert.equal(rows[0]?.id, "m-0");
    assert.equal(rows[7]?.id, "m-7");
  });

  it("shows soft gol hint only when club scored and player goals sum is 0", () => {
    assert.equal(
      shouldShowSoftStatsHint({
        homeScore: 3,
        awayScore: 1,
        isHome: true,
        playerGoalsSum: 0,
      }),
      true,
    );
    assert.equal(
      shouldShowSoftStatsHint({
        homeScore: 0,
        awayScore: 1,
        isHome: true,
        playerGoalsSum: 0,
      }),
      false,
    );
    assert.equal(
      softStatsHintForCompleteMatch({
        homeScore: 0,
        awayScore: 2,
        isHome: false,
        playerGoalsSum: 0,
      }),
      true,
    );
  });

  it("never soft-hints Pulcini from period-points stored on Event", () => {
    assert.equal(
      shouldShowSoftStatsHint({
        homeScore: 3,
        awayScore: 1,
        isHome: true,
        playerGoalsSum: 0,
        categoryName: "Pulcini",
      }),
      false,
    );
    assert.equal(
      shouldShowSoftStatsHint({
        homeScore: 3,
        awayScore: 1,
        isHome: true,
        playerGoalsSum: 0,
        categoryName: "Pulcini",
        periodScores: [
          { periodNumber: 1, homeScore: 5, awayScore: 0 },
          { periodNumber: 2, homeScore: 5, awayScore: 0 },
          { periodNumber: 3, homeScore: 5, awayScore: 0 },
          { periodNumber: 4, homeScore: 0, awayScore: 1 },
        ],
        realClubGoalsFromPeriods: 15,
      }),
      true,
    );
  });

  it("marks Pulcini incomplete until 4/4 periods even if Event has legacy scores", () => {
    const reasons = resolveIncompleteReasons({
      attendanceCount: 10,
      homeScore: 3,
      awayScore: 1,
      categoryName: "Pulcini",
      periodScores: [
        { periodNumber: 1, homeScore: 1, awayScore: 0 },
        { periodNumber: 2, homeScore: 1, awayScore: 0 },
        { periodNumber: 3, homeScore: null, awayScore: null },
      ],
    });
    assert.deepEqual(reasons, ["MISSING_RESULT"]);
  });

  it("marks Pulcini complete with 4/4 periods", () => {
    const reasons = resolveIncompleteReasons({
      attendanceCount: 10,
      homeScore: 3,
      awayScore: 1,
      categoryName: "Pulcini",
      periodScores: [
        { periodNumber: 1, homeScore: 1, awayScore: 0 },
        { periodNumber: 2, homeScore: 1, awayScore: 0 },
        { periodNumber: 3, homeScore: 1, awayScore: 0 },
        { periodNumber: 4, homeScore: 0, awayScore: 10 },
      ],
    });
    assert.deepEqual(reasons, []);
  });

  it("computes club goals for home and away", () => {
    assert.equal(clubGoalsFromResult({ homeScore: 3, awayScore: 1, isHome: true }), 3);
    assert.equal(clubGoalsFromResult({ homeScore: 3, awayScore: 1, isHome: false }), 1);
    assert.equal(clubGoalsFromResult({ homeScore: null, awayScore: 1, isHome: true }), null);
  });
});

describe("mister steppers and attendance stats", () => {
  it("never goes below zero", () => {
    assert.equal(stepValue(0, -1), 0);
    assert.equal(clampStepperValue(-5), 0);
    assert.equal(stepValue(99, 1), 99);
  });

  it("forces gol/assist to 0 when athlete is not present", () => {
    assert.deepEqual(
      normalizeStatsForStatus({ status: "ABSENT", goals: 2, assists: 1 }),
      { goals: 0, assists: 0 },
    );
    assert.deepEqual(
      normalizeStatsForStatus({ status: "PRESENT", goals: 2, assists: 1 }),
      { goals: 2, assists: 1 },
    );
  });
});

describe("mister week timeline Europe/Rome wall-clock", () => {
  it("builds Mon-Sun bounds around wall-clock now", () => {
    // Wednesday 2026-10-07
    const wallNow = new Date(Date.UTC(2026, 9, 7, 12, 0, 0));
    const { start, end } = wallClockWeekBounds(wallNow);
    assert.equal(start.toISOString(), "2026-10-05T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-10-11T23:59:59.999Z");
  });

  it("keeps today and days with events only", () => {
    const wallNow = new Date(Date.UTC(2026, 9, 7, 12, 0, 0));
    const days = buildMisterWeekTimeline(
      [
        {
          id: "t1",
          type: "TRAINING",
          title: "Allenamento",
          startAt: new Date(Date.UTC(2026, 9, 6, 18, 0, 0)),
        },
        {
          id: "m1",
          type: "LEAGUE_MATCH",
          title: "Comun Nuovo - Paladina",
          startAt: new Date(Date.UTC(2026, 9, 10, 15, 0, 0)),
        },
      ],
      wallNow,
    );
    assert.ok(days.some((d) => d.isToday));
    assert.ok(days.some((d) => d.events.some((e) => e.id === "t1")));
    assert.ok(days.some((d) => d.events.some((e) => e.id === "m1")));
    assert.ok(!days.some((d) => !d.isToday && d.events.length === 0));
  });

  it("aligns with Europe/Rome wall-clock helper", () => {
    const wall = nowAsEuropeRomeWallClockUtc(new Date("2026-10-05T10:00:00.000Z"));
    assert.equal(wall.getUTCFullYear(), 2026);
    assert.equal(wall.getUTCMonth(), 9);
  });
});
