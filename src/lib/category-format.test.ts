import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPlayersPerSide,
  resolvePlayersPerSide,
} from "./category-format";

describe("category-format", () => {
  it("isPlayersPerSide accepts only 5/7/9/11", () => {
    assert.equal(isPlayersPerSide(5), true);
    assert.equal(isPlayersPerSide(6), false);
    assert.equal(isPlayersPerSide(null), false);
  });

  it("null/empty category falls back to 11", () => {
    assert.equal(resolvePlayersPerSide(null), 11);
    assert.equal(resolvePlayersPerSide(""), 11);
    assert.equal(resolvePlayersPerSide({ name: "", playersPerSide: null }), 11);
  });
});
