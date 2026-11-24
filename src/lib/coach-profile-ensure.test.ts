import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitFullName } from "@/lib/staff";

describe("coach profile ensure naming (idempotent promotion helpers)", () => {
  it("splits Marco Criniti into first/last without inventing categories", () => {
    assert.deepEqual(splitFullName("Marco Criniti"), {
      firstName: "Marco",
      lastName: "Criniti",
    });
  });

  it("handles single-token names safely", () => {
    assert.deepEqual(splitFullName("Mister"), {
      firstName: "Mister",
      lastName: "",
    });
  });
});
