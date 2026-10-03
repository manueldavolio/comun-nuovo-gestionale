import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { updateAttendanceSchema } from "./attendance";

describe("updateAttendanceSchema", () => {
  it("accepts classic presence-only payload", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [{ athleteId: "clxxxxxxxxxxxxxxxxxxxx", status: "PRESENT" }],
    });
    assert.equal(parsed.success, true);
  });

  it("rejects goals when athlete is absent", () => {
    const parsed = updateAttendanceSchema.safeParse({
      entries: [
        {
          athleteId: "clxxxxxxxxxxxxxxxxxxxx",
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
          athleteId: "clxxxxxxxxxxxxxxxxxxxx",
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
});
