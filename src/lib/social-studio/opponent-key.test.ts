import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  editDistance,
  matchOpponentAsset,
  normalizeOpponentKey,
  resolveExactOpponentLogoUrl,
} from "@/lib/social-studio/opponent-key";

describe("normalizeOpponentKey", () => {
  it("strips prefixes and accents", () => {
    assert.equal(normalizeOpponentKey("US Albino"), "albino");
    assert.equal(normalizeOpponentKey("A.S.D. Cologno"), "cologno");
    assert.equal(normalizeOpponentKey("Virtus Bergamo"), "virtus-bergamo");
    assert.equal(normalizeOpponentKey("Atlético"), "atletico");
  });

  it("treats Or. and Oratorio as the same society name", () => {
    assert.equal(
      normalizeOpponentKey("Or. Arcene Brignano"),
      normalizeOpponentKey("Oratorio Arcene Brignano"),
    );
    assert.equal(normalizeOpponentKey("Or. Arcene Brignano"), "arcene-brignano");
  });
});

describe("matchOpponentAsset", () => {
  const assets = [
    { id: "1", label: "US Albino", normalizedKey: "albino", publicUrl: "/a.png" },
    { id: "2", label: "Cologno Calcio", normalizedKey: "cologno-calcio", publicUrl: "/c.png" },
    {
      id: "3",
      label: "Oratorio Arcene Brignano",
      normalizedKey: "arcene-brignano",
      publicUrl: "/o.png",
    },
  ];

  it("matches exact normalized names", () => {
    const match = matchOpponentAsset("ASD Albino", assets);
    assert.equal(match.kind, "exact");
    if (match.kind === "exact") assert.equal(match.asset.id, "1");
  });

  it("matches Or. abbreviation to Oratorio archive entry", () => {
    const match = matchOpponentAsset("Or. Arcene Brignano", assets);
    assert.equal(match.kind, "exact");
    if (match.kind === "exact") assert.equal(match.asset.id, "3");
  });

  it("matches slight typos fuzzily", () => {
    const match = matchOpponentAsset("Cologno Calcioo", assets);
    assert.equal(match.kind, "fuzzy");
  });

  it("returns none when far", () => {
    assert.equal(matchOpponentAsset("Inter Milano", assets).kind, "none");
  });
});

describe("resolveExactOpponentLogoUrl", () => {
  const assets = [
    { id: "1", label: "US Albino", normalizedKey: "albino", publicUrl: "/a.png" },
    { id: "2", label: "Cologno Calcio", normalizedKey: "cologno-calcio", publicUrl: "/c.png" },
  ];

  it("auto-applies only exact matches", () => {
    assert.equal(resolveExactOpponentLogoUrl("ASD Albino", assets), "/a.png");
  });

  it("does not auto-apply fuzzy/ambiguous names", () => {
    assert.equal(resolveExactOpponentLogoUrl("Cologno Calcioo", assets), null);
  });
});

describe("editDistance", () => {
  it("is zero for equals", () => {
    assert.equal(editDistance("albino", "albino"), 0);
  });
});
