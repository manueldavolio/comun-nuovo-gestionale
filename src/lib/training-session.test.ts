import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExerciseLibraryWhere,
  canManageTrainingExercise,
  canViewTrainingExercise,
  isTrainingEventType,
  moveSessionItemDown,
  moveSessionItemUp,
  normalizeDurationMin,
  normalizeTrainingTitle,
  snapshotFromExercise,
  sumSessionDurationMin,
  validateSessionItemsPayload,
} from "./training-session";

describe("isTrainingEventType", () => {
  it("accepts only TRAINING", () => {
    assert.equal(isTrainingEventType("TRAINING"), true);
    assert.equal(isTrainingEventType("LEAGUE_MATCH"), false);
    assert.equal(isTrainingEventType("FRIENDLY"), false);
  });
});

describe("normalizeTrainingTitle / duration", () => {
  it("requires non-empty title", () => {
    assert.equal(normalizeTrainingTitle("").ok, false);
    assert.equal(normalizeTrainingTitle("  ").ok, false);
    const ok = normalizeTrainingTitle("  Possesso 4vs4  ");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.title, "Possesso 4vs4");
  });

  it("accepts duration >= 0 and null", () => {
    assert.deepEqual(normalizeDurationMin(null), { ok: true, durationMin: null });
    assert.deepEqual(normalizeDurationMin(0), { ok: true, durationMin: 0 });
    assert.deepEqual(normalizeDurationMin(15), { ok: true, durationMin: 15 });
    assert.equal(normalizeDurationMin(-1).ok, false);
  });
});

describe("snapshotFromExercise", () => {
  it("copies fields so later template edits do not affect snapshot object", () => {
    const template = {
      id: "ex1",
      title: "Attivazione",
      description: "Jogging",
      durationMin: 10,
    };
    const snap = snapshotFromExercise(template);
    template.title = "MODIFICATO";
    template.description = "altro";
    template.durationMin = 99;
    assert.equal(snap.title, "Attivazione");
    assert.equal(snap.description, "Jogging");
    assert.equal(snap.durationMin, 10);
    assert.equal(snap.exerciseId, "ex1");
  });
});

describe("validateSessionItemsPayload", () => {
  it("adds free item and library snapshot fields", () => {
    const result = validateSessionItemsPayload([
      { title: "Libero", description: "x", durationMin: 5 },
      {
        exerciseId: "ex1",
        title: "Da libreria",
        description: "snap",
        durationMin: 10,
      },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]!.exerciseId, null);
    assert.equal(result.items[0]!.sortOrder, 0);
    assert.equal(result.items[1]!.exerciseId, "ex1");
    assert.equal(result.items[1]!.title, "Da libreria");
  });

  it("rejects empty title", () => {
    const result = validateSessionItemsPayload([{ title: "  " }]);
    assert.equal(result.ok, false);
  });
});

describe("sumSessionDurationMin", () => {
  it("sums only available durations", () => {
    assert.equal(
      sumSessionDurationMin([
        { durationMin: 10 },
        { durationMin: null },
        { durationMin: 20 },
        { durationMin: undefined },
      ]),
      30,
    );
  });
});

describe("item order", () => {
  it("moves up and down with reliable sortOrder", () => {
    const items = [
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ];
    const up = moveSessionItemUp(items, 2);
    assert.deepEqual(
      up.map((x) => x.id),
      ["a", "c", "b"],
    );
    assert.deepEqual(
      up.map((x) => x.sortOrder),
      [0, 1, 2],
    );
    const down = moveSessionItemDown(items, 0);
    assert.deepEqual(
      down.map((x) => x.id),
      ["b", "a", "c"],
    );
  });
});

describe("library visibility policy", () => {
  it("category exercise visible to assigned coach", () => {
    assert.equal(
      canViewTrainingExercise({
        role: "COACH",
        userId: "u1",
        allowedCategoryIds: ["catA"],
        exercise: { createdById: "other", categoryId: "catA" },
      }),
      true,
    );
  });

  it("category exercise denied for other category coach", () => {
    assert.equal(
      canViewTrainingExercise({
        role: "COACH",
        userId: "u1",
        allowedCategoryIds: ["catB"],
        exercise: { createdById: "other", categoryId: "catA" },
      }),
      false,
    );
  });

  it("personal exercise (no category) only for author", () => {
    assert.equal(
      canViewTrainingExercise({
        role: "COACH",
        userId: "author",
        allowedCategoryIds: ["catA"],
        exercise: { createdById: "author", categoryId: null },
      }),
      true,
    );
    assert.equal(
      canViewTrainingExercise({
        role: "COACH",
        userId: "other",
        allowedCategoryIds: ["catA"],
        exercise: { createdById: "author", categoryId: null },
      }),
      false,
    );
  });

  it("parent denied", () => {
    assert.equal(
      canViewTrainingExercise({
        role: "PARENT",
        userId: "p1",
        allowedCategoryIds: [],
        exercise: { createdById: "c1", categoryId: "catA" },
      }),
      false,
    );
    assert.equal(
      canManageTrainingExercise({
        role: "PARENT",
        userId: "p1",
        allowedCategoryIds: [],
        exercise: { createdById: "c1", categoryId: null },
      }),
      false,
    );
  });

  it("admin sees all", () => {
    assert.equal(
      canViewTrainingExercise({
        role: "ADMIN",
        userId: "a1",
        allowedCategoryIds: [],
        exercise: { createdById: "c1", categoryId: "catA" },
      }),
      true,
    );
  });

  it("library where for coach scopes personal + assigned categories", () => {
    const where = buildExerciseLibraryWhere({
      role: "COACH",
      userId: "u1",
      allowedCategoryIds: ["catA"],
    });
    assert.ok(Array.isArray(where.OR));
    const ors = where.OR as Array<Record<string, unknown>>;
    assert.deepEqual(ors[0], { categoryId: null, createdById: "u1" });
  });
});

describe("delete template does not destroy snapshot semantics", () => {
  it("snapshot retains title after exerciseId would be nulled", () => {
    const snap = snapshotFromExercise({
      id: "ex-del",
      title: "Possesso",
      description: "4vs4",
      durationMin: 15,
    });
    // Simulate DB SET NULL on exerciseId after template delete
    const historicItem = {
      ...snap,
      exerciseId: null as string | null,
    };
    assert.equal(historicItem.title, "Possesso");
    assert.equal(historicItem.description, "4vs4");
    assert.equal(historicItem.durationMin, 15);
    assert.equal(historicItem.exerciseId, null);
  });
});
