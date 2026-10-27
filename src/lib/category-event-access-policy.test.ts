import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideEventCategoryAccess,
  decideEventCategoryMoveAccess,
  eventCategoryAccessErrorMessage,
  youthSectorCategoryWhere,
} from "./category-event-access-policy";

describe("decideEventCategoryAccess", () => {
  it("ADMIN manages any category including null and first team", () => {
    assert.equal(
      decideEventCategoryAccess({
        role: "ADMIN",
        categoryId: null,
        sector: null,
        coachAssignedToCategory: false,
      }).allow,
      true,
    );
    assert.equal(
      decideEventCategoryAccess({
        role: "ADMIN",
        categoryId: "ft",
        sector: "FIRST_TEAM",
        coachAssignedToCategory: false,
      }).allow,
      true,
    );
  });

  it("YOUTH_DIRECTOR manages all youth without coach assignment", () => {
    const decision = decideEventCategoryAccess({
      role: "YOUTH_DIRECTOR",
      categoryId: "youth-1",
      sector: "YOUTH",
      coachAssignedToCategory: false,
    });
    assert.equal(decision.allow, true);
  });

  it("YOUTH_DIRECTOR cannot create/manage FIRST_TEAM", () => {
    const decision = decideEventCategoryAccess({
      role: "YOUTH_DIRECTOR",
      categoryId: "ft",
      sector: "FIRST_TEAM",
      coachAssignedToCategory: true,
    });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.code, "NOT_YOUTH");
  });

  it("YOUTH_DIRECTOR cannot manage unclassified or missing sector", () => {
    assert.equal(
      decideEventCategoryAccess({
        role: "YOUTH_DIRECTOR",
        categoryId: "x",
        sector: null,
        coachAssignedToCategory: false,
      }).allow,
      false,
    );
    assert.equal(
      decideEventCategoryAccess({
        role: "YOUTH_DIRECTOR",
        categoryId: "x",
        sector: "MISSING",
        coachAssignedToCategory: false,
      }).allow,
      false,
    );
  });

  it("YOUTH_DIRECTOR cannot manage events without categoryId", () => {
    const decision = decideEventCategoryAccess({
      role: "YOUTH_DIRECTOR",
      categoryId: null,
      sector: null,
      coachAssignedToCategory: false,
    });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.code, "NO_CATEGORY");
  });

  it("COACH keeps assignment limits (including first team if assigned)", () => {
    assert.equal(
      decideEventCategoryAccess({
        role: "COACH",
        categoryId: "ft",
        sector: "FIRST_TEAM",
        coachAssignedToCategory: true,
      }).allow,
      true,
    );
    assert.equal(
      decideEventCategoryAccess({
        role: "COACH",
        categoryId: "youth",
        sector: "YOUTH",
        coachAssignedToCategory: false,
      }).allow,
      false,
    );
    assert.equal(
      decideEventCategoryAccess({
        role: "COACH",
        categoryId: null,
        sector: null,
        coachAssignedToCategory: false,
      }).allow,
      false,
    );
  });

  it("PARENT is denied", () => {
    assert.equal(
      decideEventCategoryAccess({
        role: "PARENT",
        categoryId: "youth",
        sector: "YOUTH",
        coachAssignedToCategory: false,
      }).allow,
      false,
    );
  });
});

describe("decideEventCategoryMoveAccess", () => {
  it("blocks YD moving youth event to FIRST_TEAM", () => {
    const decision = decideEventCategoryMoveAccess({
      role: "YOUTH_DIRECTOR",
      sourceCategoryId: "y1",
      sourceSector: "YOUTH",
      targetCategoryId: "ft",
      targetSector: "FIRST_TEAM",
      coachAssignedToSource: false,
      coachAssignedToTarget: false,
    });
    assert.equal(decision.allow, false);
  });

  it("blocks YD moving FIRST_TEAM event to youth (direct id bypass)", () => {
    const decision = decideEventCategoryMoveAccess({
      role: "YOUTH_DIRECTOR",
      sourceCategoryId: "ft",
      sourceSector: "FIRST_TEAM",
      targetCategoryId: "y1",
      targetSector: "YOUTH",
      coachAssignedToSource: false,
      coachAssignedToTarget: false,
    });
    assert.equal(decision.allow, false);
  });

  it("allows YD move between youth categories", () => {
    const decision = decideEventCategoryMoveAccess({
      role: "YOUTH_DIRECTOR",
      sourceCategoryId: "y1",
      sourceSector: "YOUTH",
      targetCategoryId: "y2",
      targetSector: "YOUTH",
      coachAssignedToSource: false,
      coachAssignedToTarget: false,
    });
    assert.equal(decision.allow, true);
  });

  it("ADMIN can move across first team and youth", () => {
    assert.equal(
      decideEventCategoryMoveAccess({
        role: "ADMIN",
        sourceCategoryId: "ft",
        sourceSector: "FIRST_TEAM",
        targetCategoryId: "y1",
        targetSector: "YOUTH",
        coachAssignedToSource: false,
        coachAssignedToTarget: false,
      }).allow,
      true,
    );
  });

  it("COACH must be assigned to both source and target", () => {
    assert.equal(
      decideEventCategoryMoveAccess({
        role: "COACH",
        sourceCategoryId: "a",
        sourceSector: "YOUTH",
        targetCategoryId: "b",
        targetSector: "YOUTH",
        coachAssignedToSource: true,
        coachAssignedToTarget: false,
      }).allow,
      false,
    );
    assert.equal(
      decideEventCategoryMoveAccess({
        role: "COACH",
        sourceCategoryId: "a",
        sourceSector: "YOUTH",
        targetCategoryId: "b",
        targetSector: "YOUTH",
        coachAssignedToSource: true,
        coachAssignedToTarget: true,
      }).allow,
      true,
    );
  });
});

describe("helpers", () => {
  it("exposes youth sector where fragment without name heuristics", () => {
    assert.deepEqual(youthSectorCategoryWhere(), { sector: "YOUTH" });
  });

  it("maps deny codes to user-facing messages", () => {
    assert.match(eventCategoryAccessErrorMessage({ allow: false, code: "NOT_YOUTH" }), /giovanile/i);
    assert.match(eventCategoryAccessErrorMessage({ allow: false, code: "NOT_ASSIGNED" }), /categorie/);
  });
});
