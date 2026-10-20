import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideDisciplineApiAccess,
  decideMatchRatingAccess,
  resolveStaffCategoryManageability,
} from "./discipline-api-auth";

describe("discipline API authorization", () => {
  it("rejects unauthenticated callers with 401", () => {
    const result = decideDisciplineApiAccess({
      authenticated: false,
      role: null,
      canManageTargetCategory: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  it("rejects PARENT (genitori) with 403 on discipline and ratings", () => {
    const discipline = decideDisciplineApiAccess({
      authenticated: true,
      role: "PARENT",
      canManageTargetCategory: true,
    });
    assert.equal(discipline.ok, false);
    if (!discipline.ok) assert.equal(discipline.status, 403);

    const ratings = decideMatchRatingAccess({
      authenticated: true,
      role: "PARENT",
      canManageEvent: true,
      athleteBelongsToEventCategory: true,
    });
    assert.equal(ratings.ok, false);
    if (!ratings.ok) assert.equal(ratings.status, 403);
  });

  it("allows COACH only on assigned categories", () => {
    assert.equal(
      resolveStaffCategoryManageability({
        role: "COACH",
        assignedCategoryIds: ["cat-a"],
        targetCategoryId: "cat-a",
      }),
      true,
    );
    assert.equal(
      resolveStaffCategoryManageability({
        role: "COACH",
        assignedCategoryIds: ["cat-a"],
        targetCategoryId: "cat-b",
      }),
      false,
    );

    const denied = decideDisciplineApiAccess({
      authenticated: true,
      role: "COACH",
      canManageTargetCategory: false,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.status, 403);

    const allowed = decideDisciplineApiAccess({
      authenticated: true,
      role: "COACH",
      canManageTargetCategory: true,
    });
    assert.equal(allowed.ok, true);
  });

  it("blocks coach ratings on other categories / other athletes", () => {
    const otherCategory = decideMatchRatingAccess({
      authenticated: true,
      role: "COACH",
      canManageEvent: false,
      athleteBelongsToEventCategory: true,
    });
    assert.equal(otherCategory.ok, false);
    if (!otherCategory.ok) assert.equal(otherCategory.status, 403);

    const otherAthlete = decideMatchRatingAccess({
      authenticated: true,
      role: "COACH",
      canManageEvent: true,
      athleteBelongsToEventCategory: false,
    });
    assert.equal(otherAthlete.ok, false);
    if (!otherAthlete.ok) assert.equal(otherAthlete.status, 403);
  });

  it("ADMIN and YOUTH_DIRECTOR manage any category", () => {
    for (const role of ["ADMIN", "YOUTH_DIRECTOR"] as const) {
      assert.equal(
        resolveStaffCategoryManageability({
          role,
          assignedCategoryIds: [],
          targetCategoryId: "any",
        }),
        true,
      );
      const access = decideDisciplineApiAccess({
        authenticated: true,
        role,
        canManageTargetCategory: true,
      });
      assert.equal(access.ok, true);

      const rating = decideMatchRatingAccess({
        authenticated: true,
        role,
        canManageEvent: true,
        athleteBelongsToEventCategory: true,
      });
      assert.equal(rating.ok, true);
    }
  });

  it("rejects unknown roles with 403", () => {
    const result = decideDisciplineApiAccess({
      authenticated: true,
      role: "HACKER",
      canManageTargetCategory: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  });
});
