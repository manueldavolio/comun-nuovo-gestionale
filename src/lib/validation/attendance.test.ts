import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { updateAttendanceSchema } from "./attendance";

const ATHLETE_ID = "clxxxxxxxxxxxxxxxxxxxx";

describe("updateAttendanceSchema", () => {
  it("accepts classic presence-only payload", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [{ athleteId: ATHLETE_ID, status: "PRESENT" }],
    });
    assert.equal(parsed.success, true);
  });

  it("rejects goals when athlete is absent", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [
        {
          athleteId: ATHLETE_ID,
          status: "ABSENT",
          goals: 1,
          assists: 0,
        },
      ],
    });
    assert.equal(parsed.success, false);
  });

  it("accepts match result with both scores", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [
        {
          athleteId: ATHLETE_ID,
          status: "PRESENT",
          goals: 2,
          assists: 1,
        },
      ],
      matchResult: {
        opponentName: "Paladina",
        homeScore: 3,
        awayScore: 1,
        isHome: true,
      },
    });
    assert.equal(parsed.success, true);
  });

  it("accepts legacy payload without goalsConceded", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [
        {
          athleteId: ATHLETE_ID,
          status: "PRESENT",
          goals: 1,
          assists: 0,
        },
      ],
      matchResult: {
        opponentName: "Paladina",
        homeScore: 2,
        awayScore: 1,
        isHome: true,
      },
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.entries[0]?.goalsConceded, undefined);
    }
  });

  it("accepts goalsConceded null and 0 for present athletes", () => {
    assert.equal(
      updateAttendanceSchema.safeParse({
        entries: [{ athleteId: ATHLETE_ID, status: "PRESENT", goalsConceded: null }],
      }).success,
      true,
    );
    assert.equal(
      updateAttendanceSchema.safeParse({
        entries: [{ athleteId: ATHLETE_ID, status: "PRESENT", goalsConceded: 0 }],
      }).success,
      true,
    );
    assert.equal(
      updateAttendanceSchema.safeParse({
        entries: [{ athleteId: ATHLETE_ID, status: "PRESENT", goalsConceded: 2 }],
      }).success,
      true,
    );
  });

  it("rejects goalsConceded when athlete is absent", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [{ athleteId: ATHLETE_ID, status: "ABSENT", goalsConceded: 1 }],
    });
    assert.equal(parsed.success, false);
  });

  it("accepts four-period scores without regressing classic fields", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [
        {
          athleteId: ATHLETE_ID,
          status: "PRESENT",
          goals: 1,
          assists: 0,
          goalsConceded: 0,
        },
      ],
      matchResult: {
        opponentName: "Paladina",
        isHome: true,
      },
      periodScores: [
        { periodNumber: 1, homeScore: 1, awayScore: 0 },
        { periodNumber: 2, homeScore: 0, awayScore: 1 },
        { periodNumber: 3, homeScore: null, awayScore: null },
        { periodNumber: 4, homeScore: 2, awayScore: 1 },
      ],
    });
    assert.equal(parsed.success, true);
  });

  it("rejects partial classic match result", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [{ athleteId: ATHLETE_ID, status: "PRESENT" }],
      matchResult: { homeScore: 1, awayScore: null },
    });
    assert.equal(parsed.success, false);
  });
});
