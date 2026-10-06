import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAddActivePersonalGoal,
  countActivePersonalGoals,
  isActivePersonalGoalStatus,
  isPersonalGoalStatus,
  normalizePersonalGoalText,
  validatePersonalGoalActiveLimit,
} from "./athlete-personal-goals";
import {
  formatCoachNoteAuthorLabel,
  normalizePositiveCoachTags,
} from "./coach-note-tags";

describe("athlete personal goals", () => {
  it("treats IN_PROGRESS and CONTINUE as active", () => {
    assert.equal(isActivePersonalGoalStatus("IN_PROGRESS"), true);
    assert.equal(isActivePersonalGoalStatus("CONTINUE"), true);
    assert.equal(isActivePersonalGoalStatus("ACHIEVED"), false);
  });

  it("counts active goals and enforces max 3", () => {
    const goals = [
      { status: "IN_PROGRESS" as const },
      { status: "CONTINUE" as const },
      { status: "ACHIEVED" as const },
      { status: "IN_PROGRESS" as const },
    ];
    assert.equal(countActivePersonalGoals(goals), 3);
    assert.equal(canAddActivePersonalGoal(3), false);
    assert.equal(canAddActivePersonalGoal(2), true);
  });

  it("ACHIEVED frees a slot for a new active goal", () => {
    const before = validatePersonalGoalActiveLimit({
      existingActiveCount: 3,
      nextStatus: "IN_PROGRESS",
    });
    assert.equal(before.ok, false);

    const afterAchieve = validatePersonalGoalActiveLimit({
      existingActiveCount: 2,
      nextStatus: "IN_PROGRESS",
    });
    assert.equal(afterAchieve.ok, true);

    const achievedOk = validatePersonalGoalActiveLimit({
      existingActiveCount: 3,
      nextStatus: "ACHIEVED",
    });
    assert.equal(achievedOk.ok, true);
  });

  it("validates statuses and rejects empty text", () => {
    assert.equal(isPersonalGoalStatus("IN_PROGRESS"), true);
    assert.equal(isPersonalGoalStatus("WRONG"), false);
    assert.equal(normalizePersonalGoalText(""), null);
    assert.equal(normalizePersonalGoalText("   "), null);
    assert.equal(normalizePersonalGoalText("Piede debole"), "Piede debole");
  });
});

describe("coach note positive tags", () => {
  it("accepts 0–3 valid tags", () => {
    assert.deepEqual(normalizePositiveCoachTags(undefined), { ok: true, tags: [] });
    assert.deepEqual(normalizePositiveCoachTags([]), { ok: true, tags: [] });
    assert.deepEqual(normalizePositiveCoachTags(["IMPEGNO"]), {
      ok: true,
      tags: ["IMPEGNO"],
    });
    assert.deepEqual(
      normalizePositiveCoachTags(["IMPEGNO", "CRESCITA", "COSTANZA"]),
      { ok: true, tags: ["IMPEGNO", "CRESCITA", "COSTANZA"] },
    );
  });

  it("rejects more than 3 tags and invalid tags", () => {
    const tooMany = normalizePositiveCoachTags([
      "IMPEGNO",
      "CRESCITA",
      "COSTANZA",
      "CORAGGIO",
    ]);
    assert.equal(tooMany.ok, false);

    const invalid = normalizePositiveCoachTags(["VOTO"]);
    assert.equal(invalid.ok, false);
  });

  it("dedupes tags and keeps legacy empty-tag notes valid", () => {
    assert.deepEqual(normalizePositiveCoachTags(["IMPEGNO", "IMPEGNO"]), {
      ok: true,
      tags: ["IMPEGNO"],
    });
    assert.deepEqual(normalizePositiveCoachTags(null), { ok: true, tags: [] });
  });

  it("labels authors without pretending ADMIN is mister", () => {
    assert.equal(
      formatCoachNoteAuthorLabel({ name: "Mario", role: "COACH" }).fullLabel,
      "Mister Mario",
    );
    assert.equal(
      formatCoachNoteAuthorLabel({ name: "Anna", role: "ADMIN" }).fullLabel,
      "Staff · Anna",
    );
    assert.equal(
      formatCoachNoteAuthorLabel({ name: "Luca", role: "YOUTH_DIRECTOR" }).prefix,
      "Staff",
    );
  });
});
