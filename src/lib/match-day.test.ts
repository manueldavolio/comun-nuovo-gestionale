import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGoogleMapsSearchUrl,
  matchDayScoreLines,
  matchDayTeamLayout,
  resolveMatchDayPhase,
  resolveMatchVisualEndAt,
  selectTodaysMatchDayEvent,
  shouldSuppressNextEventForMatchDay,
  wallClockDayBounds,
} from "./match-day";

function utcWall(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
}

describe("match-day helpers", () => {
  it("builds Italian calendar day bounds from wall-clock now", () => {
    const wallNow = utcWall(2026, 10, 3, 16, 30);
    const bounds = wallClockDayBounds(wallNow);
    assert.equal(bounds.start.toISOString(), "2026-10-03T00:00:00.000Z");
    assert.equal(bounds.end.toISOString(), "2026-10-03T23:59:59.999Z");
  });

  it("returns null when there is no match today", () => {
    const wallNow = utcWall(2026, 10, 3, 12, 0);
    const selected = selectTodaysMatchDayEvent(
      [
        {
          id: "a",
          type: "LEAGUE_MATCH",
          startAt: utcWall(2026, 10, 2, 15, 0),
          endAt: null,
        },
        {
          id: "b",
          type: "TRAINING",
          startAt: utcWall(2026, 10, 3, 18, 0),
          endAt: null,
        },
      ],
      wallNow,
    );
    assert.equal(selected, null);
  });

  it("selects PRE_MATCH before kickoff", () => {
    const wallNow = utcWall(2026, 10, 3, 10, 0);
    const kickoff = utcWall(2026, 10, 3, 15, 0);
    assert.equal(
      resolveMatchDayPhase({ startAt: kickoff, endAt: null, wallNow }),
      "PRE_MATCH",
    );
    const selected = selectTodaysMatchDayEvent(
      [
        {
          id: "m1",
          type: "LEAGUE_MATCH",
          startAt: kickoff,
          endAt: null,
        },
      ],
      wallNow,
    );
    assert.equal(selected?.id, "m1");
  });

  it("selects LIVE during kickoff window", () => {
    const kickoff = utcWall(2026, 10, 3, 15, 0);
    const wallNow = utcWall(2026, 10, 3, 15, 30);
    assert.equal(resolveMatchDayPhase({ startAt: kickoff, endAt: null, wallNow }), "LIVE");
    assert.equal(
      resolveMatchVisualEndAt(kickoff, null).toISOString(),
      utcWall(2026, 10, 3, 17, 0).toISOString(),
    );
  });

  it("uses endAt when present for LIVE / FULL_TIME", () => {
    const kickoff = utcWall(2026, 10, 3, 15, 0);
    const endAt = utcWall(2026, 10, 3, 16, 30);
    assert.equal(
      resolveMatchDayPhase({
        startAt: kickoff,
        endAt,
        wallNow: utcWall(2026, 10, 3, 16, 0),
      }),
      "LIVE",
    );
    assert.equal(
      resolveMatchDayPhase({
        startAt: kickoff,
        endAt,
        wallNow: utcWall(2026, 10, 3, 16, 31),
      }),
      "FULL_TIME",
    );
  });

  it("marks FULL_TIME after default 2h window without endAt", () => {
    const kickoff = utcWall(2026, 10, 3, 15, 0);
    assert.equal(
      resolveMatchDayPhase({
        startAt: kickoff,
        endAt: null,
        wallNow: utcWall(2026, 10, 3, 17, 1),
      }),
      "FULL_TIME",
    );
  });

  it("prefers LIVE over PRE_MATCH when both exist today", () => {
    const wallNow = utcWall(2026, 10, 3, 15, 20);
    const selected = selectTodaysMatchDayEvent(
      [
        {
          id: "evening",
          type: "FRIENDLY",
          startAt: utcWall(2026, 10, 3, 18, 0),
          endAt: null,
        },
        {
          id: "live",
          type: "LEAGUE_MATCH",
          startAt: utcWall(2026, 10, 3, 15, 0),
          endAt: null,
        },
      ],
      wallNow,
    );
    assert.equal(selected?.id, "live");
  });

  it("among PRE_MATCH picks the soonest kickoff", () => {
    const wallNow = utcWall(2026, 10, 3, 9, 0);
    const selected = selectTodaysMatchDayEvent(
      [
        {
          id: "later",
          type: "LEAGUE_MATCH",
          startAt: utcWall(2026, 10, 3, 18, 0),
          endAt: null,
        },
        {
          id: "sooner",
          type: "TOURNAMENT",
          startAt: utcWall(2026, 10, 3, 11, 0),
          endAt: null,
        },
      ],
      wallNow,
    );
    assert.equal(selected?.id, "sooner");
  });

  it("among FULL_TIME picks the most recent kickoff", () => {
    const wallNow = utcWall(2026, 10, 3, 20, 0);
    const selected = selectTodaysMatchDayEvent(
      [
        {
          id: "morning",
          type: "LEAGUE_MATCH",
          startAt: utcWall(2026, 10, 3, 10, 0),
          endAt: utcWall(2026, 10, 3, 11, 30),
        },
        {
          id: "afternoon",
          type: "LEAGUE_MATCH",
          startAt: utcWall(2026, 10, 3, 15, 0),
          endAt: utcWall(2026, 10, 3, 16, 30),
        },
      ],
      wallNow,
    );
    assert.equal(selected?.id, "afternoon");
  });

  it("layouts home and away teams", () => {
    assert.deepEqual(matchDayTeamLayout({ opponentName: "Paladina", isHome: true }), {
      topName: "Comun Nuovo",
      bottomName: "Paladina",
      mode: "home",
    });
    assert.deepEqual(matchDayTeamLayout({ opponentName: "Paladina", isHome: false }), {
      topName: "Paladina",
      bottomName: "Comun Nuovo",
      mode: "away",
    });
    assert.equal(matchDayTeamLayout({ opponentName: "Paladina", isHome: null }).mode, "neutral");
  });

  it("orders full-time scores for home and away", () => {
    assert.deepEqual(
      matchDayScoreLines({
        opponentName: "Paladina",
        isHome: true,
        homeScore: 3,
        awayScore: 1,
      }),
      { leftName: "Comun Nuovo", leftScore: 3, rightName: "Paladina", rightScore: 1 },
    );
    assert.deepEqual(
      matchDayScoreLines({
        opponentName: "Paladina",
        isHome: false,
        homeScore: 0,
        awayScore: 2,
      }),
      { leftName: "Paladina", leftScore: 0, rightName: "Comun Nuovo", rightScore: 2 },
    );
  });

  it("builds Maps URL with encoding and skips empty location", () => {
    assert.equal(buildGoogleMapsSearchUrl("  "), null);
    assert.equal(buildGoogleMapsSearchUrl(null), null);
    assert.equal(
      buildGoogleMapsSearchUrl("Centro Sportivo Comun Nuovo"),
      "https://www.google.com/maps/search/?api=1&query=Centro%20Sportivo%20Comun%20Nuovo",
    );
    assert.ok(buildGoogleMapsSearchUrl("Via Roma 1, Bergamo")?.includes("Via%20Roma%201"));
  });

  it("suppresses duplicate next-event when Match Day owns the same event", () => {
    assert.equal(shouldSuppressNextEventForMatchDay("evt-1", "evt-1"), true);
    assert.equal(shouldSuppressNextEventForMatchDay("evt-2", "evt-1"), false);
    assert.equal(shouldSuppressNextEventForMatchDay(null, "evt-1"), false);
  });

  it("exposes athlete stats only when goals/assists > 0 (caller contract)", () => {
    const goals = 2;
    const assists = 0;
    const lines = [
      goals > 0 ? `${goals} GOL` : null,
      assists > 0 ? `${assists} ASSIST` : null,
    ].filter(Boolean);
    assert.deepEqual(lines, ["2 GOL"]);
  });
});
