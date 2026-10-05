import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceEffectiveClosesAtOnlyEarlier,
  buildMatchSideLabels,
  computeEffectiveClosesAt,
  evaluatePredictionEntry,
  evaluatePredictionPick,
  formatPredictionChoiceLabel,
  isEventEligibleForPredictionSlip,
  isWithinDashboardHistoryWindow,
  resolveOfficialPredictionOutcome,
  resolveSlipLockState,
  validateCompletePicksPayload,
} from "./prediction-slip";

describe("resolveOfficialPredictionOutcome", () => {
  it("maps home win / draw / away win", () => {
    assert.equal(resolveOfficialPredictionOutcome(2, 1), "HOME");
    assert.equal(resolveOfficialPredictionOutcome(1, 1), "DRAW");
    assert.equal(resolveOfficialPredictionOutcome(0, 3), "AWAY");
  });

  it("treats 0-0 as DRAW", () => {
    assert.equal(resolveOfficialPredictionOutcome(0, 0), "DRAW");
  });

  it("treats null scores as PENDING", () => {
    assert.equal(resolveOfficialPredictionOutcome(null, null), "PENDING");
    assert.equal(resolveOfficialPredictionOutcome(1, null), "PENDING");
    assert.equal(resolveOfficialPredictionOutcome(null, 0), "PENDING");
  });
});

describe("effective close freeze at publish", () => {
  it("publish freezes min(closesAt, first kickoff)", () => {
    const closesAt = new Date("2026-10-12T15:00:00.000Z"); // domenica 15:00
    const firstKickoff = new Date("2026-10-11T17:00:00.000Z"); // sabato 17:00
    const second = new Date("2026-10-12T10:00:00.000Z");
    const frozen = computeEffectiveClosesAt(closesAt, [firstKickoff, second]);
    assert.equal(frozen.toISOString(), firstKickoff.toISOString());
  });

  it("postponing Event after publish does not change frozen effectiveClosesAt", () => {
    const frozen = new Date("2026-10-11T17:00:00.000Z");
    const closesAt = new Date("2026-10-12T15:00:00.000Z");
    // Even if live kickoffs move later, lock uses frozen value only.
    const afterPostpone = resolveSlipLockState({
      lockedAt: null,
      effectiveClosesAt: frozen,
      now: new Date("2026-10-11T18:00:00.000Z"),
    });
    assert.equal(afterPostpone.state, "LOCKED");
    assert.equal(afterPostpone.effectiveClosesAt.toISOString(), frozen.toISOString());

    // Live recalculation would wrongly reopen — we must NOT use it.
    const liveWouldBe = computeEffectiveClosesAt(closesAt, [
      new Date("2026-10-12T18:00:00.000Z"),
    ]);
    assert.equal(liveWouldBe.toISOString(), closesAt.toISOString());
    assert.notEqual(liveWouldBe.toISOString(), frozen.toISOString());
  });

  it("anticipating closesAt can only move effectiveClosesAt earlier", () => {
    const current = new Date("2026-10-11T17:00:00.000Z");
    const earlierCloses = new Date("2026-10-11T16:00:00.000Z");
    const laterCloses = new Date("2026-10-12T18:00:00.000Z");
    assert.equal(
      advanceEffectiveClosesAtOnlyEarlier(current, earlierCloses).toISOString(),
      earlierCloses.toISOString(),
    );
    assert.equal(
      advanceEffectiveClosesAtOnlyEarlier(current, laterCloses).toISOString(),
      current.toISOString(),
    );
  });

  it("now == effectiveClosesAt => LOCKED", () => {
    const at = new Date("2026-10-11T14:30:00.000Z");
    const lock = resolveSlipLockState({
      lockedAt: null,
      effectiveClosesAt: at,
      now: at,
    });
    assert.equal(lock.state, "LOCKED");
    assert.equal(lock.shouldPersistLockedAt, true);
  });

  it("lockedAt keeps LOCKED even if caller passes a later deadline by mistake", () => {
    const lock = resolveSlipLockState({
      lockedAt: new Date("2026-10-11T17:00:00.000Z"),
      effectiveClosesAt: new Date("2026-10-12T18:00:00.000Z"),
      now: new Date("2026-10-11T17:30:00.000Z"),
    });
    assert.equal(lock.state, "LOCKED");
    assert.equal(lock.shouldPersistLockedAt, false);
  });
});

describe("pick and entry evaluation", () => {
  it("evaluates CORRECT / WRONG / PENDING", () => {
    assert.equal(evaluatePredictionPick({ choice: "HOME", homeScore: 2, awayScore: 1 }), "CORRECT");
    assert.equal(evaluatePredictionPick({ choice: "HOME", homeScore: 1, awayScore: 1 }), "WRONG");
    assert.equal(evaluatePredictionPick({ choice: "AWAY", homeScore: null, awayScore: null }), "PENDING");
  });

  it("marks perfect only when all resolved and all correct", () => {
    const perfect = evaluatePredictionEntry({
      slipEventCount: 2,
      picks: [
        { choice: "HOME", homeScore: 1, awayScore: 0 },
        { choice: "DRAW", homeScore: 0, awayScore: 0 },
      ],
    });
    assert.equal(perfect.perfect, true);
    assert.equal(perfect.evaluable, true);
    assert.equal(perfect.correct, 2);

    const pending = evaluatePredictionEntry({
      slipEventCount: 2,
      picks: [
        { choice: "HOME", homeScore: 1, awayScore: 0 },
        { choice: "DRAW", homeScore: null, awayScore: null },
      ],
    });
    assert.equal(pending.perfect, false);
    assert.equal(pending.pending, 1);
  });

  it("incomplete picks cannot be perfect", () => {
    const result = evaluatePredictionEntry({
      slipEventCount: 3,
      picks: [{ choice: "HOME", homeScore: 1, awayScore: 0 }],
    });
    assert.equal(result.perfect, false);
    assert.equal(result.pending, 2);
  });
});

describe("payload validation and PUT post-close semantics", () => {
  it("rejects incomplete, foreign, duplicate, invalid choice", () => {
    assert.equal(
      validateCompletePicksPayload({
        slipEventIds: ["a", "b"],
        picks: [{ slipEventId: "a", choice: "HOME" }],
      }).ok,
      false,
    );
    assert.equal(
      validateCompletePicksPayload({
        slipEventIds: ["a", "b"],
        picks: [
          { slipEventId: "a", choice: "HOME" },
          { slipEventId: "z", choice: "DRAW" },
        ],
      }).ok,
      false,
    );
    assert.equal(
      validateCompletePicksPayload({
        slipEventIds: ["a"],
        picks: [{ slipEventId: "a", choice: "ONE" }],
      }).ok,
      false,
    );
  });

  it("PUT after effectiveClosesAt would be LOCKED (transaction recheck input)", () => {
    const deadline = new Date("2026-10-11T14:30:00.000Z");
    const after = resolveSlipLockState({
      lockedAt: null,
      effectiveClosesAt: deadline,
      now: new Date("2026-10-11T14:30:00.000Z"),
    });
    assert.equal(after.state, "LOCKED");
  });

  it("accepts only match-like events with home/away and resolvable opponent", () => {
    assert.equal(
      isEventEligibleForPredictionSlip({
        type: "TRAINING",
        startAt: new Date(),
        isHome: true,
        opponentName: "Paladina",
        title: "Allenamento",
      }).ok,
      false,
    );
    assert.equal(
      isEventEligibleForPredictionSlip({
        type: "FRIENDLY",
        startAt: new Date(),
        isHome: false,
        opponentName: "Curno",
        title: "Amichevole",
      }).ok,
      true,
    );
  });
});

describe("labels and dashboard window", () => {
  it("builds home/away labels", () => {
    assert.deepEqual(
      buildMatchSideLabels({ isHome: true, opponentName: "Paladina" }),
      { homeLabel: "Comun Nuovo", awayLabel: "Paladina" },
    );
    assert.equal(formatPredictionChoiceLabel("DRAW"), "X");
  });

  it("limits dashboard history window", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    assert.equal(
      isWithinDashboardHistoryWindow({
        referenceAt: new Date("2026-10-10T12:00:00.000Z"),
        now,
        days: 21,
      }),
      true,
    );
  });
});

describe("Pulcini/Esordienti use Event scores only", () => {
  it("reads official Event period-points as HOME/DRAW/AWAY without summing goals", () => {
    assert.equal(resolveOfficialPredictionOutcome(3, 1), "HOME");
    assert.equal(resolveOfficialPredictionOutcome(null, null), "PENDING");
  });
});
