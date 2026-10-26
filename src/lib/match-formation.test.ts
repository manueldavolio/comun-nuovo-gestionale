import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPlayersPerSideLabel,
  resolvePlayersPerSide,
} from "./category-format";
import {
  athleteNotInConvocationWarning,
  buildStarterSlotsForModule,
  defaultModuleForPlayersPerSide,
  emptyCustomStarterSlots,
  expectedStarterSlotKeys,
  formationDraftSnapshot,
  isFormationModuleId,
  isMatchFormationEventType,
  isModuleCompatibleWithPlayersPerSide,
  moduleChangeWouldReassignAthletes,
  modulesForPlayersPerSide,
  nextBenchSlotKey,
  nextCustomStarterSlotKey,
  pitchLinesForModule,
  placeAthleteOnSlot,
  remapSlotsForModule,
  starterCountForModule,
  swapFormationSlots,
  validateFormationSlots,
} from "./match-formation";

function athleteIds(slots: Array<{ athleteId: string | null }>): string[] {
  return slots
    .map((s) => s.athleteId)
    .filter((id): id is string => Boolean(id))
    .sort();
}

describe("resolvePlayersPerSide", () => {
  it("Primi Calci = 5", () => {
    assert.equal(resolvePlayersPerSide("Primi Calci"), 5);
    assert.equal(resolvePlayersPerSide({ name: "Primi calci 2018" }), 5);
  });

  it("Pulcini = 7", () => {
    assert.equal(resolvePlayersPerSide("Pulcini"), 7);
    assert.equal(resolvePlayersPerSide({ name: "Pulcini 2016/2017" }), 7);
  });

  it("Esordienti = 9", () => {
    assert.equal(resolvePlayersPerSide("Esordienti"), 9);
    assert.equal(resolvePlayersPerSide({ name: "Esordienti U15" }), 9);
  });

  it("altre = 11", () => {
    assert.equal(resolvePlayersPerSide("Under 15"), 11);
    assert.equal(resolvePlayersPerSide("Giovanissimi"), 11);
    assert.equal(resolvePlayersPerSide("Scuola Calcio"), 11);
  });

  it("valore esplicito prevale sul nome", () => {
    assert.equal(resolvePlayersPerSide({ name: "Pulcini", playersPerSide: 11 }), 11);
    assert.equal(resolvePlayersPerSide({ name: "Under 15", playersPerSide: 7 }), 7);
  });

  it("format label", () => {
    assert.equal(formatPlayersPerSideLabel(7), "Calcio a 7");
  });
});

describe("modulesForPlayersPerSide", () => {
  it("5 restituisce solo moduli 5v5 + CUSTOM", () => {
    assert.deepEqual(modulesForPlayersPerSide(5), [
      "1-2-1",
      "2-1-1",
      "1-1-2",
      "CUSTOM",
    ]);
  });

  it("7 restituisce solo 7v7 + CUSTOM", () => {
    assert.deepEqual(modulesForPlayersPerSide(7), [
      "2-3-1",
      "3-2-1",
      "2-2-2",
      "CUSTOM",
    ]);
  });

  it("9 restituisce solo 9v9 + CUSTOM", () => {
    assert.deepEqual(modulesForPlayersPerSide(9), [
      "3-3-2",
      "3-2-3",
      "2-3-3",
      "CUSTOM",
    ]);
  });

  it("11 restituisce solo 11v11 + CUSTOM", () => {
    assert.deepEqual(modulesForPlayersPerSide(11), [
      "4-3-3",
      "4-4-2",
      "4-2-3-1",
      "3-5-2",
      "3-4-3",
      "CUSTOM",
    ]);
  });
});

describe("isMatchFormationEventType", () => {
  it("allows match types only", () => {
    assert.equal(isMatchFormationEventType("LEAGUE_MATCH"), true);
    assert.equal(isMatchFormationEventType("FRIENDLY"), true);
    assert.equal(isMatchFormationEventType("TOURNAMENT"), true);
    assert.equal(isMatchFormationEventType("TRAINING"), false);
  });
});

describe("slot generation counts", () => {
  it("1-2-1 => 5 titolari", () => {
    assert.equal(starterCountForModule("1-2-1"), 5);
    assert.equal(expectedStarterSlotKeys("1-2-1").length, 5);
    assert.deepEqual(expectedStarterSlotKeys("1-2-1"), [
      "POR",
      "DF1",
      "MF1",
      "MF2",
      "FW1",
    ]);
  });

  it("2-3-1 => 7", () => {
    assert.equal(starterCountForModule("2-3-1"), 7);
  });

  it("3-3-2 => 9", () => {
    assert.equal(starterCountForModule("3-3-2"), 9);
  });

  it("4-3-3 => 11", () => {
    assert.equal(starterCountForModule("4-3-3"), 11);
    assert.deepEqual(expectedStarterSlotKeys("4-3-3"), [
      "POR",
      "DF1",
      "DF2",
      "DF3",
      "DF4",
      "MF1",
      "MF2",
      "MF3",
      "FW1",
      "FW2",
      "FW3",
    ]);
  });

  it("pitch lines order attack to goalkeeper", () => {
    const lines = pitchLinesForModule("4-3-3");
    assert.equal(lines[0]?.role, "FWD");
    assert.equal(lines[lines.length - 1]?.role, "GK");
  });
});

describe("validateFormationSlots by format", () => {
  const allowed = new Set(["a1", "a2", "a3", "a4", "a5", "a6", "a7"]);

  it("accepts valid 4-3-3 for 11v11", () => {
    const keys = expectedStarterSlotKeys("4-3-3");
    const result = validateFormationSlots({
      module: "4-3-3",
      playersPerSide: 11,
      slots: keys.map((slotKey) => ({ slotKey, athleteId: null, isBench: false })),
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, true);
  });

  it("Pulcini (7) non accetta 4-3-3", () => {
    const result = validateFormationSlots({
      module: "4-3-3",
      playersPerSide: 7,
      slots: expectedStarterSlotKeys("4-3-3").map((slotKey) => ({
        slotKey,
        isBench: false,
      })),
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, false);
  });

  it("Esordienti (9) non accetta 2-3-1", () => {
    const result = validateFormationSlots({
      module: "2-3-1",
      playersPerSide: 9,
      slots: expectedStarterSlotKeys("2-3-1").map((slotKey) => ({
        slotKey,
        isBench: false,
      })),
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, false);
  });

  it("Primi Calci (5) non accetta 3-3-2", () => {
    const result = validateFormationSlots({
      module: "3-3-2",
      playersPerSide: 5,
      slots: expectedStarterSlotKeys("3-3-2").map((slotKey) => ({
        slotKey,
        isBench: false,
      })),
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, false);
  });

  it("11v11 non accetta 1-2-1", () => {
    assert.equal(isModuleCompatibleWithPlayersPerSide("1-2-1", 11), false);
    const result = validateFormationSlots({
      module: "1-2-1",
      playersPerSide: 11,
      slots: expectedStarterSlotKeys("1-2-1").map((slotKey) => ({
        slotKey,
        isBench: false,
      })),
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, false);
  });

  it("panchina non conta nei titolari CUSTOM", () => {
    const starters = emptyCustomStarterSlots(7);
    const result = validateFormationSlots({
      module: "CUSTOM",
      playersPerSide: 7,
      slots: [
        ...starters,
        { slotKey: "BENCH_1", athleteId: "a1", isBench: true },
        { slotKey: "BENCH_2", athleteId: "a2", isBench: true },
      ],
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, true);
  });

  it("CUSTOM con titolari diversi da formato denied", () => {
    const result = validateFormationSlots({
      module: "CUSTOM",
      playersPerSide: 7,
      slots: emptyCustomStarterSlots(5),
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, false);
  });

  it("denies duplicate athlete starter+bench", () => {
    const keys = expectedStarterSlotKeys("2-3-1");
    const slots = [
      ...keys.map((slotKey) => ({
        slotKey,
        athleteId: slotKey === "POR" ? "a1" : null,
        isBench: false,
      })),
      { slotKey: "BENCH_1", athleteId: "a1", isBench: true },
    ];
    const result = validateFormationSlots({
      module: "2-3-1",
      playersPerSide: 7,
      slots,
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, false);
  });

  it("denies athlete outside pool", () => {
    const keys = expectedStarterSlotKeys("1-2-1");
    const result = validateFormationSlots({
      module: "1-2-1",
      playersPerSide: 5,
      slots: keys.map((slotKey) => ({
        slotKey,
        athleteId: slotKey === "POR" ? "outsider" : null,
        isBench: false,
      })),
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, false);
  });

  it("accepts 7v7 2-3-1", () => {
    const result = validateFormationSlots({
      module: "2-3-1",
      playersPerSide: 7,
      slots: expectedStarterSlotKeys("2-3-1").map((slotKey) => ({
        slotKey,
        isBench: false,
      })),
      allowedAthleteIds: allowed,
    });
    assert.equal(result.ok, true);
  });
});

describe("helpers", () => {
  it("increments bench and custom", () => {
    assert.equal(nextBenchSlotKey(["BENCH_1", "BENCH_3"]), "BENCH_4");
    assert.equal(nextCustomStarterSlotKey(["CUSTOM_1"]), "CUSTOM_2");
  });

  it("default module per format", () => {
    assert.equal(defaultModuleForPlayersPerSide(5), "1-2-1");
    assert.equal(defaultModuleForPlayersPerSide(7), "2-3-1");
    assert.equal(defaultModuleForPlayersPerSide(9), "3-3-2");
    assert.equal(defaultModuleForPlayersPerSide(11), "4-3-3");
  });

  it("convocation warning", () => {
    const convocated = new Set(["a1"]);
    assert.equal(
      athleteNotInConvocationWarning("a2", convocated),
      "Questo atleta non risulta nella convocazione.",
    );
  });

  it("module id guard", () => {
    assert.equal(isFormationModuleId("1-2-1"), true);
    assert.equal(isFormationModuleId("5-3-2"), false);
  });

  it("buildStarterSlotsForModule yields unique keys", () => {
    const slots = buildStarterSlotsForModule("4-2-3-1");
    assert.equal(new Set(slots.map((s) => s.slotKey)).size, slots.length);
  });

  it("placeAthleteOnSlot swaps when both slots occupied without duplicates", () => {
    const slots = [
      { slotKey: "POR", athleteId: "a1", isBench: false },
      { slotKey: "FW1", athleteId: "a2", isBench: false },
      { slotKey: "BENCH_1", athleteId: null, isBench: true },
    ];
    const next = placeAthleteOnSlot(slots, "FW1", "a1");
    assert.equal(next.find((s) => s.slotKey === "FW1")?.athleteId, "a1");
    assert.equal(next.find((s) => s.slotKey === "POR")?.athleteId, "a2");
    assert.deepEqual(athleteIds(next), ["a1", "a2"]);
  });

  it("placeAthleteOnSlot moves from pool onto occupied and frees previous", () => {
    const slots = [
      { slotKey: "POR", athleteId: "a1", isBench: false },
      { slotKey: "FW1", athleteId: null, isBench: false },
    ];
    const next = placeAthleteOnSlot(slots, "POR", "a9");
    assert.equal(next.find((s) => s.slotKey === "POR")?.athleteId, "a9");
    assert.equal(
      next.every((s) => s.athleteId !== "a1"),
      true,
    );
  });

  it("placeAthleteOnSlot moves field to empty bench without loss", () => {
    const slots = [
      { slotKey: "POR", athleteId: "a1", isBench: false },
      { slotKey: "FW1", athleteId: "a2", isBench: false },
      { slotKey: "BENCH_1", athleteId: null, isBench: true },
    ];
    const next = placeAthleteOnSlot(slots, "BENCH_1", "a2");
    assert.equal(next.find((s) => s.slotKey === "FW1")?.athleteId, null);
    assert.equal(next.find((s) => s.slotKey === "BENCH_1")?.athleteId, "a2");
    assert.deepEqual(athleteIds(next), ["a1", "a2"]);
  });

  it("placeAthleteOnSlot swaps occupied field with occupied bench", () => {
    const slots = [
      { slotKey: "POR", athleteId: "a1", isBench: false },
      { slotKey: "BENCH_1", athleteId: "a2", isBench: true },
    ];
    const next = placeAthleteOnSlot(slots, "POR", "a2");
    assert.equal(next.find((s) => s.slotKey === "POR")?.athleteId, "a2");
    assert.equal(next.find((s) => s.slotKey === "BENCH_1")?.athleteId, "a1");
    assert.deepEqual(athleteIds(next), ["a1", "a2"]);
  });

  it("swapFormationSlots exchanges athletes", () => {
    const slots = [
      { slotKey: "POR", athleteId: "a1", isBench: false },
      { slotKey: "BENCH_1", athleteId: "a2", isBench: true },
    ];
    const next = swapFormationSlots(slots, "POR", "BENCH_1");
    assert.equal(next.find((s) => s.slotKey === "POR")?.athleteId, "a2");
    assert.equal(next.find((s) => s.slotKey === "BENCH_1")?.athleteId, "a1");
    assert.deepEqual(athleteIds(next), ["a1", "a2"]);
  });

  it("formationDraftSnapshot changes when assignments change", () => {
    const base = [
      { slotKey: "POR", athleteId: "a1", isBench: false },
      { slotKey: "FW1", athleteId: null, isBench: false },
    ];
    const a = formationDraftSnapshot("4-3-3", base);
    const b = formationDraftSnapshot(
      "4-3-3",
      placeAthleteOnSlot(base, "FW1", "a1"),
    );
    assert.notEqual(a, b);
  });

  it("remapSlotsForModule keeps matching keys and parks orphans on bench", () => {
    const previous = [
      { slotKey: "POR", athleteId: "gk", isBench: false },
      { slotKey: "DF1", athleteId: "d1", isBench: false },
      { slotKey: "DF2", athleteId: "d2", isBench: false },
      { slotKey: "DF3", athleteId: "d3", isBench: false },
      { slotKey: "MF1", athleteId: "m1", isBench: false },
      { slotKey: "MF2", athleteId: "m2", isBench: false },
      { slotKey: "MF3", athleteId: "m3", isBench: false },
      { slotKey: "FW1", athleteId: "f1", isBench: false },
      { slotKey: "FW2", athleteId: "f2", isBench: false },
      // 3-3-2 → 3-2-3: MF3 diventa orfano di chiave, FW3 nasce vuoto
    ];
    const next = remapSlotsForModule("3-2-3", previous, 9);
    assert.equal(next.find((s) => s.slotKey === "POR")?.athleteId, "gk");
    assert.equal(next.find((s) => s.slotKey === "FW1")?.athleteId, "f1");
    assert.equal(next.find((s) => s.slotKey === "FW2")?.athleteId, "f2");
    assert.ok(next.some((s) => s.slotKey === "FW3"));
    assert.deepEqual(athleteIds(next), athleteIds(previous));
    assert.equal(new Set(athleteIds(next)).size, athleteIds(next).length);
  });

  it("remapSlotsForModule to CUSTOM preserves all athletes", () => {
    const previous = [
      { slotKey: "POR", athleteId: "a1", isBench: false },
      { slotKey: "DF1", athleteId: "a2", isBench: false },
      { slotKey: "MF1", athleteId: "a3", isBench: false },
      { slotKey: "MF2", athleteId: "a4", isBench: false },
      { slotKey: "FW1", athleteId: "a5", isBench: false },
      { slotKey: "BENCH_1", athleteId: "b1", isBench: true },
    ];
    const next = remapSlotsForModule("CUSTOM", previous, 5);
    assert.equal(next.filter((s) => !s.isBench).length, 5);
    assert.deepEqual(athleteIds(next), ["a1", "a2", "a3", "a4", "a5", "b1"]);
  });

  it("moduleChangeWouldReassignAthletes detects real moves", () => {
    const previous = [
      { slotKey: "POR", athleteId: "gk", isBench: false },
      { slotKey: "FW3", athleteId: "f3", isBench: false },
      ...expectedStarterSlotKeys("4-3-3")
        .filter((k) => k !== "POR" && k !== "FW3")
        .map((slotKey) => ({ slotKey, athleteId: null, isBench: false })),
    ];
    assert.equal(
      moduleChangeWouldReassignAthletes("4-3-3", "4-4-2", previous, 11),
      true,
    );
    assert.equal(
      moduleChangeWouldReassignAthletes("4-3-3", "4-3-3", previous, 11),
      false,
    );
  });
});
