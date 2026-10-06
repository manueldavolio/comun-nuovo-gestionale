import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNoSessionToolsLeak,
  findSessionToolsLeakKeys,
  isParentSafeEventSelect,
  parentPayloadHasSessionToolsLeak,
} from "./session-tools-privacy";

describe("anti-leak parent payloads", () => {
  it("parent dashboard-like event has no formation/training", () => {
    const payload = {
      events: [
        {
          id: "e1",
          title: "Partita",
          type: "LEAGUE_MATCH",
          homeScore: 1,
          awayScore: 0,
          category: { name: "U15" },
        },
      ],
    };
    assert.equal(parentPayloadHasSessionToolsLeak(payload), false);
    assertNoSessionToolsLeak(payload);
  });

  it("flags matchFormation on event", () => {
    const payload = {
      id: "e1",
      matchFormation: { module: "4-3-3", slots: [] },
    };
    assert.equal(parentPayloadHasSessionToolsLeak(payload), true);
    assert.ok(findSessionToolsLeakKeys(payload).includes("matchFormation"));
  });

  it("flags trainingSession on event", () => {
    const payload = {
      id: "e1",
      trainingSession: { notes: "focus", items: [] },
    };
    assert.ok(parentPayloadHasSessionToolsLeak(payload));
  });

  it("Match Day parent shape is safe", () => {
    const matchDay = {
      eventId: "e1",
      title: "vs Rivali",
      homeScore: null,
      awayScore: null,
      periodScores: [],
      athletes: [{ id: "a1", firstName: "Mario", lastName: "Rossi" }],
    };
    assertNoSessionToolsLeak(matchDay);
  });

  it("calendario genitore select keys reject formation relations", () => {
    assert.equal(
      isParentSafeEventSelect(["id", "title", "type", "startAt", "category"]).ok,
      true,
    );
    const bad = isParentSafeEventSelect(["id", "matchFormation", "trainingSession"]);
    assert.equal(bad.ok, false);
  });

  it("prediction slip event select must not include formation", () => {
    const slipEventSelect = [
      "id",
      "title",
      "type",
      "startAt",
      "opponentName",
      "homeScore",
      "awayScore",
      "isHome",
      "category",
    ];
    assert.equal(isParentSafeEventSelect(slipEventSelect).ok, true);
    assert.equal(
      parentPayloadHasSessionToolsLeak({
        events: [{ id: "e1", title: "x", picks: [] }],
      }),
      false,
    );
  });

  it("assert throws on leak", () => {
    assert.throws(() =>
      assertNoSessionToolsLeak({ formation: { module: "4-3-3" } }),
    );
  });
});
