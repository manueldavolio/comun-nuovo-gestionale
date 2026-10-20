import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMissingDisciplineSchemaError } from "./discipline-db";

describe("isMissingDisciplineSchemaError", () => {
  it("detects Prisma missing table/column codes", () => {
    assert.equal(isMissingDisciplineSchemaError({ code: "P2021" }), true);
    assert.equal(isMissingDisciplineSchemaError({ code: "P2022" }), true);
  });

  it("detects missing MatchPlayerRating / competitionKind messages", () => {
    assert.equal(
      isMissingDisciplineSchemaError(
        new Error('The table `public.MatchPlayerRating` does not exist in the current database.'),
      ),
      true,
    );
    assert.equal(
      isMissingDisciplineSchemaError(
        new Error("Unknown arg `competitionKind` in data.competitionKind"),
      ),
      true,
    );
  });

  it("ignores unrelated errors", () => {
    assert.equal(isMissingDisciplineSchemaError(new Error("Connection refused")), false);
    assert.equal(isMissingDisciplineSchemaError(null), false);
  });
});
