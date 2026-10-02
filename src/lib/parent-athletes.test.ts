import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  athletesAssociatedToParentWhere,
  birthDatesMatchUtc,
  dedupeByNormalizedKey,
  normalizeAthleteTaxCode,
  parentUsersLinkedToCategoryWhere,
} from "./parent-athletes";

describe("parent-athletes authorization helpers", () => {
  it("builds athlete association where for primary OR additional parent", () => {
    const where = athletesAssociatedToParentWhere("parent-1");
    assert.deepEqual(where, {
      OR: [
        { parentId: "parent-1" },
        { additionalParents: { some: { parentId: "parent-1" } } },
      ],
    });
  });

  it("builds category parent recipient where including additional links", () => {
    const where = parentUsersLinkedToCategoryWhere("cat-1");
    assert.equal(where.role, "PARENT");
    assert.ok(where.parentProfile);
  });

  it("normalizes tax codes and matches birth dates", () => {
    assert.equal(normalizeAthleteTaxCode(" ab c "), "ABC");
    const day = new Date(Date.UTC(2014, 5, 1));
    assert.equal(birthDatesMatchUtc(day, new Date(Date.UTC(2014, 5, 1))), true);
    assert.equal(birthDatesMatchUtc(day, new Date(Date.UTC(2014, 5, 2))), false);
  });
});

describe("parent-athletes notification dedupe", () => {
  it("dedupes email and phone for multi-parent sends", () => {
    const emailRecipients = [
      { email: "a@club.it", athleteFullName: "Figlio", parentFullName: "A" },
      { email: "A@club.it", athleteFullName: "Figlio", parentFullName: "B" },
      { email: "b@club.it", athleteFullName: "Figlio", parentFullName: "C" },
    ];
    const emails = dedupeByNormalizedKey(emailRecipients, (item) => item.email);
    assert.equal(emails.length, 2);

    const phoneRecipients = [
      { phone: "333111", athleteFullName: "Figlio", parentFullName: "A" },
      { phone: "333111", athleteFullName: "Figlio", parentFullName: "B" },
      { phone: "333222", athleteFullName: "Figlio", parentFullName: "C" },
    ];
    const phones = dedupeByNormalizedKey(phoneRecipients, (item) => item.phone);
    assert.equal(phones.length, 2);
  });
});
