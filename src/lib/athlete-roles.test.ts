import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAthleteRoleDisplay,
  hasAssignedAthleteRole,
  isGoalkeeperRole,
  normalizeMatchPlayerStatsForSave,
  parseCanonicalAthleteRole,
  shouldPersistMatchPlayerStat,
} from "./athlete-roles";
import { updateAttendanceSchema } from "./validation/attendance";

describe("athlete roles", () => {
  it("parses only canonical codes", () => {
    assert.equal(parseCanonicalAthleteRole("POR"), "POR");
    assert.equal(parseCanonicalAthleteRole("dif"), "DIF");
    assert.equal(parseCanonicalAthleteRole("Difensore"), null);
    assert.equal(parseCanonicalAthleteRole("Portiere"), null);
    assert.equal(parseCanonicalAthleteRole(null), null);
  });

  it("detects goalkeeper only for POR", () => {
    assert.equal(isGoalkeeperRole("POR"), true);
    assert.equal(isGoalkeeperRole("DIF"), false);
    assert.equal(isGoalkeeperRole("Portiere"), false);
  });

  it("formats display for canonical, legacy, missing", () => {
    assert.equal(formatAthleteRoleDisplay("POR"), "POR");
    assert.equal(formatAthleteRoleDisplay("Difensore"), "Difensore");
    assert.equal(formatAthleteRoleDisplay(null), "Ruolo da assegnare");
    assert.equal(hasAssignedAthleteRole("CEN"), true);
    assert.equal(hasAssignedAthleteRole("Centrocampista"), false);
  });
});

describe("goalsConceded normalize + persist", () => {
  it("POR present + null keeps null", () => {
    assert.deepEqual(
      normalizeMatchPlayerStatsForSave({
        status: "PRESENT",
        goals: 0,
        assists: 0,
        goalsConceded: null,
        isGoalkeeper: true,
      }),
      { goals: 0, assists: 0, goalsConceded: null },
    );
  });

  it("POR present + 0 clean sheet", () => {
    assert.deepEqual(
      normalizeMatchPlayerStatsForSave({
        status: "PRESENT",
        goals: 0,
        assists: 0,
        goalsConceded: 0,
        isGoalkeeper: true,
      }),
      { goals: 0, assists: 0, goalsConceded: 0 },
    );
    assert.equal(
      shouldPersistMatchPlayerStat({
        present: true,
        goals: 0,
        assists: 0,
        goalsConceded: 0,
      }),
      true,
    );
  });

  it("POR present + 2", () => {
    assert.deepEqual(
      normalizeMatchPlayerStatsForSave({
        status: "PRESENT",
        goals: 0,
        assists: 1,
        goalsConceded: 2,
        isGoalkeeper: true,
      }),
      { goals: 0, assists: 1, goalsConceded: 2 },
    );
  });

  it("absent forces goalsConceded null when provided", () => {
    assert.deepEqual(
      normalizeMatchPlayerStatsForSave({
        status: "ABSENT",
        goals: 2,
        assists: 1,
        goalsConceded: 3,
        isGoalkeeper: true,
      }),
      { goals: 0, assists: 0, goalsConceded: null },
    );
  });

  it("non-goalkeeper clears goalsConceded on write", () => {
    assert.deepEqual(
      normalizeMatchPlayerStatsForSave({
        status: "PRESENT",
        goals: 1,
        assists: 0,
        goalsConceded: 2,
        isGoalkeeper: false,
      }),
      { goals: 1, assists: 0, goalsConceded: null },
    );
  });

  it("null goalsConceded with zero goals does not persist row", () => {
    assert.equal(
      shouldPersistMatchPlayerStat({
        present: true,
        goals: 0,
        assists: 0,
        goalsConceded: null,
      }),
      false,
    );
  });

  it("undefined goalsConceded preserves existing conceded for persist decision", () => {
    assert.equal(
      shouldPersistMatchPlayerStat({
        present: true,
        goals: 0,
        assists: 0,
        goalsConceded: undefined,
        existingGoalsConceded: 0,
      }),
      true,
    );
  });
});

describe("attendance schema goalsConceded", () => {
  it("accepts legacy payload without goalsConceded", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [
        {
          athleteId: "clxxxxxxxxxxxxxxxxxxxx",
          status: "PRESENT",
          goals: 1,
          assists: 0,
        },
      ],
    });
    assert.equal(parsed.success, true);
  });

  it("accepts POR goalsConceded 0 and null", () => {
    assert.equal(
      updateAttendanceSchema.safeParse({
        entries: [
          {
            athleteId: "clxxxxxxxxxxxxxxxxxxxx",
            status: "PRESENT",
            goals: 0,
            assists: 0,
            goalsConceded: 0,
          },
        ],
      }).success,
      true,
    );
    assert.equal(
      updateAttendanceSchema.safeParse({
        entries: [
          {
            athleteId: "clxxxxxxxxxxxxxxxxxxxx",
            status: "PRESENT",
            goalsConceded: null,
          },
        ],
      }).success,
      true,
    );
  });

  it("rejects goalsConceded when absent", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [
        {
          athleteId: "clxxxxxxxxxxxxxxxxxxxx",
          status: "ABSENT",
          goalsConceded: 1,
        },
      ],
    });
    assert.equal(parsed.success, false);
  });

  it("rejects negative goalsConceded", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [
        {
          athleteId: "clxxxxxxxxxxxxxxxxxxxx",
          status: "PRESENT",
          goalsConceded: -1,
        },
      ],
    });
    assert.equal(parsed.success, false);
  });
});
