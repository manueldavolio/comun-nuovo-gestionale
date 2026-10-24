import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  editDistance,
  matchOpponentAsset,
  normalizeOpponentKey,
} from "@/lib/social-studio/opponent-key";

describe("normalizeOpponentKey", () => {
  it("strips prefixes and accents", () => {
    assert.equal(normalizeOpponentKey("US Albino"), "albino");
    assert.equal(normalizeOpponentKey("A.S.D. Cologno"), "cologno");
    assert.equal(normalizeOpponentKey("Virtus Bergamo"), "virtus-bergamo");
    assert.equal(normalizeOpponentKey("Atlético"), "atletico");
  });
});

describe("matchOpponentAsset", () => {
  const assets = [
    { id: "1", label: "US Albino", normalizedKey: "albino", publicUrl: "/a.png" },
    { id: "2", label: "Cologno Calcio", normalizedKey: "cologno-calcio", publicUrl: "/c.png" },
  ];

  it("matches exact normalized names", () => {
    const match = matchOpponentAsset("ASD Albino", assets);
    assert.equal(match.kind, "exact");
    if (match.kind === "exact") assert.equal(match.asset.id, "1");
  });

  it("matches slight typos fuzzily", () => {
    const match = matchOpponentAsset("Cologno Calcioo", assets);
    assert.equal(match.kind, "fuzzy");
  });

  it("returns none when far", () => {
    assert.equal(matchOpponentAsset("Inter Milano", assets).kind, "none");
  });
});

describe("editDistance", () => {
  it("is zero for equals", () => {
    assert.equal(editDistance("albino", "albino"), 0);
  });
});
