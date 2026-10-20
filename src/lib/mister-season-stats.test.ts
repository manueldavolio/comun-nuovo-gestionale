import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMisterSeasonAthleteStats } from "./mister-season-stats";

describe("mister-season-stats", () => {
  it("aggregates attendance goals ratings and discipline without inventing zeros for ratings", () => {
    const rows = buildMisterSeasonAthleteStats({
      athletes: [
        { id: "a1", firstName: "Mario", lastName: "Rossi" },
        { id: "a2", firstName: "Luca", lastName: "Bianchi" },
      ],
      attendances: [
        { athleteId: "a1", status: "PRESENT", eventType: "TRAINING" },
        { athleteId: "a1", status: "PRESENT", eventType: "LEAGUE_MATCH" },
        { athleteId: "a1", status: "ABSENT", eventType: "LEAGUE_MATCH" },
        { athleteId: "a2", status: "PRESENT", eventType: "TRAINING" },
      ],
      matchStats: [{ athleteId: "a1", goals: 2 }],
      ratings: [
        {
          athleteId: "a1",
          possessionScore: 8,
          outOfPossessionScore: null,
          attitudeScore: 6,
          teamworkScore: null,
        },
      ],
      disciplineByAthlete: new Map([
        [
          "a1",
          {
            yellowCards: 3,
            yellowCardsForAccumulation: 3,
            redCards: 0,
            openSuspensionMatchdaysFromOpening: 0,
            remainingSuspensions: 1,
          },
        ],
      ]),
    });

    const mario = rows.find((row) => row.athleteId === "a1");
    const luca = rows.find((row) => row.athleteId === "a2");
    assert.ok(mario);
    assert.ok(luca);
    assert.equal(mario.goals, 2);
    assert.equal(mario.yellowCards, 3);
    assert.equal(mario.remainingSuspensions, 1);
    assert.equal(mario.ratingOverall, 7);
    assert.equal(luca.ratingOverall, null);
    assert.equal(luca.yellowCards, 0);
  });

  it("does not let unevaluated players pull down seasonal rating averages of others", () => {
    const rows = buildMisterSeasonAthleteStats({
      athletes: [
        { id: "rated", firstName: "A", lastName: "Uno" },
        { id: "blank", firstName: "B", lastName: "Due" },
      ],
      attendances: [],
      matchStats: [],
      ratings: [
        {
          athleteId: "rated",
          possessionScore: 8,
          outOfPossessionScore: 8,
          attitudeScore: 8,
          teamworkScore: 8,
        },
      ],
      disciplineByAthlete: new Map(),
    });
    const rated = rows.find((row) => row.athleteId === "rated");
    const blank = rows.find((row) => row.athleteId === "blank");
    assert.equal(rated?.ratingOverall, 8);
    assert.equal(blank?.ratingOverall, null);
  });
});
