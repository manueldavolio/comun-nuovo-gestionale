import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canServeSuspensionOnEvent,
  defaultCompetitionKindFromEventType,
  defaultCountsForDiscipline,
  resolveEventCompetitionFields,
} from "./competition-kind";
import {
  computeDisciplineTotals,
  decideCreateSuspension,
  decideUpsertOpeningBalance,
  remainingMatchdays,
  totalRemainingMatchdays,
  yellowContribution,
  redContribution,
} from "./discipline";

describe("competition-kind", () => {
  it("maps event types", () => {
    assert.equal(defaultCompetitionKindFromEventType("LEAGUE_MATCH"), "LEAGUE");
    assert.equal(defaultCompetitionKindFromEventType("FRIENDLY"), "FRIENDLY");
    assert.equal(defaultCompetitionKindFromEventType("TRAINING"), null);
  });

  it("friendly does not count for discipline by default", () => {
    assert.equal(defaultCountsForDiscipline("FRIENDLY"), false);
    assert.equal(defaultCountsForDiscipline("LEAGUE"), true);
  });

  it("resolves create/update fields with CUP override and training null", () => {
    const league = resolveEventCompetitionFields({
      type: "LEAGUE_MATCH",
      competitionKind: "CUP",
      categorySeasonLabel: "2026/2027",
    });
    assert.equal(league.competitionKind, "CUP");
    assert.equal(league.seasonLabel, "2026/2027");
    assert.equal(league.countsForDiscipline, true);

    const training = resolveEventCompetitionFields({
      type: "TRAINING",
      competitionKind: "LEAGUE",
      categorySeasonLabel: "2026/2027",
    });
    assert.equal(training.competitionKind, null);
    assert.equal(training.countsForDiscipline, false);

    const legacy = resolveEventCompetitionFields({
      type: "LEAGUE_MATCH",
      categorySeasonLabel: "2026/2027",
    });
    assert.equal(legacy.competitionKind, "LEAGUE");
  });

  it("blocks cross-competition serving unless allowed", () => {
    assert.equal(
      canServeSuspensionOnEvent({
        suspensionKind: "LEAGUE",
        eventKind: "CUP",
        eventCountsForDiscipline: true,
      }),
      false,
    );
    assert.equal(
      canServeSuspensionOnEvent({
        suspensionKind: "LEAGUE",
        eventKind: "LEAGUE",
        eventCountsForDiscipline: true,
      }),
      true,
    );
    assert.equal(
      canServeSuspensionOnEvent({
        suspensionKind: "LEAGUE",
        eventKind: "FRIENDLY",
        eventCountsForDiscipline: false,
      }),
      false,
    );
  });
});

describe("discipline totals", () => {
  it("sums opening + later incidents only", () => {
    const ref = new Date("2026-10-01T12:00:00.000Z");
    const totals = computeDisciplineTotals({
      opening: {
        priorYellowCards: 3,
        priorYellowCardsForAccumulation: 3,
        priorRedCards: 0,
        openSuspensionMatchdays: 1,
        referenceDate: ref,
      },
      incidents: [
        {
          type: "YELLOW_CARD",
          status: "ACTIVE",
          eventStartAt: new Date("2026-09-15T12:00:00.000Z"),
          createdAt: new Date("2026-09-16T12:00:00.000Z"),
        },
        {
          type: "YELLOW_CARD",
          status: "ACTIVE",
          eventStartAt: new Date("2026-10-12T12:00:00.000Z"),
          createdAt: new Date("2026-10-12T18:00:00.000Z"),
        },
        {
          type: "RED_CARD",
          status: "VOIDED",
          eventStartAt: new Date("2026-10-20T12:00:00.000Z"),
          createdAt: new Date("2026-10-20T18:00:00.000Z"),
        },
      ],
    });

    assert.equal(totals.yellowCards, 4);
    assert.equal(totals.yellowCardsForAccumulation, 4);
    assert.equal(totals.redCards, 0);
    assert.equal(totals.openSuspensionMatchdaysFromOpening, 1);
  });

  it("counts second yellow as 2 yellow + 1 red", () => {
    assert.equal(yellowContribution("SECOND_YELLOW_RED"), 2);
    assert.equal(redContribution("SECOND_YELLOW_RED"), 1);
  });

  it("adds SECOND_YELLOW_RED after opening without double-counting pre-reference events", () => {
    const ref = new Date("2026-10-01T12:00:00.000Z");
    const totals = computeDisciplineTotals({
      opening: {
        priorYellowCards: 2,
        priorYellowCardsForAccumulation: 2,
        priorRedCards: 0,
        openSuspensionMatchdays: 0,
        referenceDate: ref,
      },
      incidents: [
        {
          type: "SECOND_YELLOW_RED",
          status: "ACTIVE",
          eventStartAt: new Date("2026-09-20T12:00:00.000Z"),
          createdAt: new Date("2026-09-20T18:00:00.000Z"),
        },
        {
          type: "SECOND_YELLOW_RED",
          status: "ACTIVE",
          eventStartAt: new Date("2026-10-18T12:00:00.000Z"),
          createdAt: new Date("2026-10-18T18:00:00.000Z"),
        },
      ],
    });
    // pregresso 2 gialli + solo la doppia ammonizione post-riferimento (+2 gialli, +1 rosso)
    assert.equal(totals.yellowCards, 4);
    assert.equal(totals.redCards, 1);
  });
});

describe("suspension remaining", () => {
  it("requires explicit SERVED servings", () => {
    const remaining = remainingMatchdays({
      status: "ACTIVE",
      matchdaysTotal: 2,
      servings: [{ status: "PENDING" }, { status: "SERVED" }],
    });
    assert.equal(remaining, 1);
  });

  it("adds opening open matchdays", () => {
    assert.equal(
      totalRemainingMatchdays(
        [
          {
            status: "ACTIVE",
            matchdaysTotal: 2,
            servings: [{ status: "SERVED" }, { status: "PENDING" }],
          },
        ],
        1,
      ),
      2,
    );
  });
});

describe("opening / suspension decisions", () => {
  it("rejects accumulation > historical yellows", () => {
    const result = decideUpsertOpeningBalance({
      seasonLabel: "2026/2027",
      competitionKind: "LEAGUE",
      priorYellowCards: 2,
      priorYellowCardsForAccumulation: 3,
      priorRedCards: 0,
      openSuspensionMatchdays: 0,
      referenceDate: new Date(),
      notes: null,
    });
    assert.equal(result.ok, false);
  });

  it("creates pending servings equal to matchdays", () => {
    const result = decideCreateSuspension({
      matchdaysTotal: 2,
      officialRef: "CU 12",
      decidedAt: new Date(),
      notes: null,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.servingsToCreate, 2);
    }
  });
});
