import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATEGORY_SECTOR_VALUES,
  canYouthDirectorAccessCategorySector,
  categorySectorLabel,
  isCategorySectorValue,
  isFirstTeamCategorySector,
  isUnclassifiedCategorySector,
  isYouthCategorySector,
  normalizeCategorySector,
} from "./category-sector";

describe("category-sector classification", () => {
  it("exposes only YOUTH and FIRST_TEAM as classified values", () => {
    assert.deepEqual([...CATEGORY_SECTOR_VALUES], ["YOUTH", "FIRST_TEAM"]);
    assert.equal(isCategorySectorValue("YOUTH"), true);
    assert.equal(isCategorySectorValue("FIRST_TEAM"), true);
    assert.equal(isCategorySectorValue(null), false);
    assert.equal(isCategorySectorValue(""), false);
    assert.equal(isCategorySectorValue("SENIOR"), false);
  });

  it("normalizes valid sectors and treats missing/unknown as unclassified", () => {
    assert.equal(normalizeCategorySector("YOUTH"), "YOUTH");
    assert.equal(normalizeCategorySector("FIRST_TEAM"), "FIRST_TEAM");
    assert.equal(normalizeCategorySector("  YOUTH  "), "YOUTH");
    assert.equal(normalizeCategorySector(null), null);
    assert.equal(normalizeCategorySector(undefined), null);
    assert.equal(normalizeCategorySector(""), null);
    assert.equal(normalizeCategorySector("   "), null);
    assert.equal(normalizeCategorySector("youth"), null);
    assert.equal(normalizeCategorySector("Prima Squadra"), null);
    assert.equal(normalizeCategorySector(1), null);
  });

  it("flags youth / first team / unclassified correctly", () => {
    assert.equal(isYouthCategorySector("YOUTH"), true);
    assert.equal(isYouthCategorySector("FIRST_TEAM"), false);
    assert.equal(isYouthCategorySector(null), false);

    assert.equal(isFirstTeamCategorySector("FIRST_TEAM"), true);
    assert.equal(isFirstTeamCategorySector("YOUTH"), false);
    assert.equal(isFirstTeamCategorySector(null), false);

    assert.equal(isUnclassifiedCategorySector(null), true);
    assert.equal(isUnclassifiedCategorySector("YOUTH"), false);
    assert.equal(isUnclassifiedCategorySector("FIRST_TEAM"), false);
  });

  it("fail-closed: YOUTH_DIRECTOR only accesses explicit YOUTH", () => {
    assert.equal(canYouthDirectorAccessCategorySector("YOUTH"), true);
    assert.equal(canYouthDirectorAccessCategorySector("FIRST_TEAM"), false);
    assert.equal(canYouthDirectorAccessCategorySector(null), false);
  });

  it("labels sectors for ADMIN UI without inventing a default sector", () => {
    assert.equal(categorySectorLabel("YOUTH"), "Settore giovanile");
    assert.equal(categorySectorLabel("FIRST_TEAM"), "Prima Squadra");
    assert.equal(categorySectorLabel(null), "Da classificare");
  });

  it("compatibility: existing null sector rows remain unclassified", () => {
    // Migrazione lascia sector NULL; nessuna classificazione implicita da nome.
    const legacyRow: { name: string; sector: null } = { name: "Pulcini", sector: null };
    assert.equal(normalizeCategorySector(legacyRow.sector), null);
    assert.equal(isUnclassifiedCategorySector(legacyRow.sector), true);
    assert.equal(canYouthDirectorAccessCategorySector(legacyRow.sector), false);
  });

  it("new categories without explicit classification stay denied for YD", () => {
    const createdWithoutSector = { sector: normalizeCategorySector(undefined) };
    assert.equal(createdWithoutSector.sector, null);
    assert.equal(canYouthDirectorAccessCategorySector(createdWithoutSector.sector), false);
  });
});
