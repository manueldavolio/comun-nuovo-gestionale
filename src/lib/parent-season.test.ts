import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  athleteInitials,
  computeSeasonAthleteStats,
  computeSeasonBadges,
  currentSeasonRange,
  formatMatchResultLabel,
  isMatchEventType,
} from "./parent-season";

describe("parent-season helpers", () => {
  it("detects match event types", () => {
    assert.equal(isMatchEventType("LEAGUE_MATCH"), true);
    assert.equal(isMatchEventType("TRAINING"), false);
  });

  it("computes season range starting in August", () => {
    const range = currentSeasonRange(new Date(Date.UTC(2026, 9, 3)));
    assert.equal(range.start.toISOString().slice(0, 10), "2026-08-01");
    assert.equal(range.end.toISOString().slice(0, 10), "2027-07-31");
  });

  it("aggregates attendance and match stats", () => {
    const stats = computeSeasonAthleteStats({
      attendances: [
        { status: "PRESENT", eventType: "TRAINING" },
        { status: "ABSENT", eventType: "TRAINING" },
        { status: "PRESENT", eventType: "LEAGUE_MATCH" },
        { status: "ABSENT", eventType: "LEAGUE_MATCH" },
      ],
      matchStats: [
        { goals: 2, assists: 1 },
        { goals: 0, assists: 1 },
      ],
    });

    assert.equal(stats.matchPresences, 1);
    assert.equal(stats.goals, 2);
    assert.equal(stats.assists, 2);
    assert.equal(stats.trainingMarked, 2);
    assert.equal(stats.trainingPresent, 1);
    assert.equal(stats.trainingPercent, 50);
  });

  it("builds only earned badges", () => {
    const badges = computeSeasonBadges({
      matchPresences: 5,
      goals: 1,
      assists: 0,
      trainingMarked: 10,
      trainingPresent: 10,
      trainingPercent: 100,
    });
    const labels = badges.map((badge) => badge.label);
    assert.ok(labels.includes("Prima presenza"));
    assert.ok(labels.includes("Primo gol"));
    assert.ok(labels.includes("5 presenze"));
    assert.ok(labels.includes("10 allenamenti"));
    assert.ok(labels.includes("90% allenamenti"));
    assert.equal(labels.includes("5 gol"), false);
  });

  it("formats home and away results", () => {
    assert.equal(
      formatMatchResultLabel({
        opponentName: "Paladina",
        homeScore: 3,
        awayScore: 1,
        isHome: true,
        fallbackTitle: "Partita",
      }),
      "Comun Nuovo 3 - 1 Paladina",
    );
    assert.equal(
      formatMatchResultLabel({
        opponentName: "Paladina",
        homeScore: 0,
        awayScore: 2,
        isHome: false,
        fallbackTitle: "Partita",
      }),
      "Paladina 0 - 2 Comun Nuovo",
    );
    assert.equal(
      formatMatchResultLabel({
        opponentName: "Paladina",
        homeScore: null,
        awayScore: null,
        isHome: true,
        fallbackTitle: "Partita",
      }),
      null,
    );
  });

  it("builds initials", () => {
    assert.equal(athleteInitials("Mario", "Rossi"), "MR");
  });
});
