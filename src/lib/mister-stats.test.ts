import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAthleteAttendanceStats,
  countConvocationResponses,
  presencePercent,
} from "./mister-stats";

describe("mister stats helpers", () => {
  it("computes presence percent safely", () => {
    assert.equal(presencePercent(8, 10), 80);
    assert.equal(presencePercent(0, 0), null);
  });

  it("aggregates athlete attendance and sorts by presence", () => {
    const stats = buildAthleteAttendanceStats(
      [
        { id: "a1", firstName: "Luca", lastName: "Bianchi" },
        { id: "a2", firstName: "Marco", lastName: "Rossi" },
        { id: "a3", firstName: "Paolo", lastName: "Verdi" },
      ],
      [
        { athleteId: "a1", status: "PRESENT" },
        { athleteId: "a1", status: "PRESENT" },
        { athleteId: "a1", status: "ABSENT" },
        { athleteId: "a2", status: "PRESENT" },
        { athleteId: "a2", status: "PRESENT" },
      ],
    );

    assert.equal(stats[0]?.athleteId, "a2");
    assert.equal(stats[0]?.presencePercent, 100);
    assert.equal(stats[1]?.athleteId, "a1");
    assert.equal(stats[1]?.presencePercent, 67);
    assert.equal(stats[2]?.athleteId, "a3");
    assert.equal(stats[2]?.presencePercent, null);
  });

  it("counts convocation responses", () => {
    const counts = countConvocationResponses([
      { responseStatus: "PENDING" },
      { responseStatus: "PRESENT" },
      { responseStatus: "ABSENT" },
      { responseStatus: "PENDING" },
    ]);
    assert.deepEqual(counts, { PENDING: 2, PRESENT: 1, ABSENT: 1 });
  });
});
