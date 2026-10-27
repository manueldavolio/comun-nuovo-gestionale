import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { upsertCategorySchema } from "./categories";

const base = {
  name: "Pulcini",
  birthYearsLabel: "2016-2017",
  isActive: true,
  playersPerSide: 7 as const,
};

describe("upsertCategorySchema sector", () => {
  it("accepts create/update with YOUTH", () => {
    const parsed = upsertCategorySchema.safeParse({ ...base, sector: "YOUTH" });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal(parsed.data.sector, "YOUTH");
  });

  it("accepts create/update with FIRST_TEAM", () => {
    const parsed = upsertCategorySchema.safeParse({
      ...base,
      name: "Prima Squadra",
      playersPerSide: 11,
      sector: "FIRST_TEAM",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal(parsed.data.sector, "FIRST_TEAM");
  });

  it("rejects missing classification", () => {
    const parsed = upsertCategorySchema.safeParse(base);
    assert.equal(parsed.success, false);
  });

  it("rejects null / empty / unknown sector (no implicit YOUTH)", () => {
    assert.equal(upsertCategorySchema.safeParse({ ...base, sector: null }).success, false);
    assert.equal(upsertCategorySchema.safeParse({ ...base, sector: "" }).success, false);
    assert.equal(upsertCategorySchema.safeParse({ ...base, sector: "SENIOR" }).success, false);
  });

  it("preserves other fields when sector is set (legacy edit payload shape)", () => {
    const parsed = upsertCategorySchema.safeParse({
      name: "Esordienti",
      birthYearsLabel: "2014-2015",
      isActive: false,
      playersPerSide: 9,
      sector: "YOUTH",
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.name, "Esordienti");
    assert.equal(parsed.data.birthYearsLabel, "2014-2015");
    assert.equal(parsed.data.isActive, false);
    assert.equal(parsed.data.playersPerSide, 9);
    assert.equal(parsed.data.sector, "YOUTH");
  });
});
