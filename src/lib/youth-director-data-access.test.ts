import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideYouthDirectorAnnouncementCreate,
  decideYouthDirectorAthleteCategoryMove,
  decideYouthDirectorCategoryDataAccess,
  youthDirectorAnnouncementWhere,
  youthDirectorAthleteWhere,
  youthDirectorDataAccessErrorMessage,
  youthDirectorMediaItemWhere,
  youthDirectorParentLinkRequestWhere,
  youthDirectorParentUserWhere,
} from "@/lib/youth-director-data-access-policy";

describe("decideYouthDirectorCategoryDataAccess", () => {
  it("ADMIN allows FIRST_TEAM, null sector, missing", () => {
    assert.equal(
      decideYouthDirectorCategoryDataAccess({
        role: "ADMIN",
        categoryId: "ft",
        sector: "FIRST_TEAM",
      }).allow,
      true,
    );
    assert.equal(
      decideYouthDirectorCategoryDataAccess({
        role: "ADMIN",
        categoryId: null,
        sector: null,
      }).allow,
      true,
    );
  });

  it("YD allows only explicit YOUTH", () => {
    assert.equal(
      decideYouthDirectorCategoryDataAccess({
        role: "YOUTH_DIRECTOR",
        categoryId: "y1",
        sector: "YOUTH",
      }).allow,
      true,
    );
  });

  it("YD denies FIRST_TEAM, null sector, missing, no category", () => {
    for (const input of [
      { categoryId: "ft", sector: "FIRST_TEAM" as const },
      { categoryId: "u1", sector: null },
      { categoryId: "x", sector: "MISSING" as const },
      { categoryId: null, sector: "YOUTH" as const },
    ]) {
      const d = decideYouthDirectorCategoryDataAccess({
        role: "YOUTH_DIRECTOR",
        ...input,
      });
      assert.equal(d.allow, false);
    }
  });

  it("COACH and PARENT are forbidden on this admin data helper", () => {
    assert.equal(
      decideYouthDirectorCategoryDataAccess({
        role: "COACH",
        categoryId: "y1",
        sector: "YOUTH",
      }).allow,
      false,
    );
    assert.equal(
      decideYouthDirectorCategoryDataAccess({
        role: "PARENT",
        categoryId: "y1",
        sector: "YOUTH",
      }).allow,
      false,
    );
  });
});

describe("decideYouthDirectorAthleteCategoryMove", () => {
  it("blocks YD move to or from FIRST_TEAM", () => {
    assert.equal(
      decideYouthDirectorAthleteCategoryMove({
        role: "YOUTH_DIRECTOR",
        sourceCategoryId: "y1",
        sourceSector: "YOUTH",
        targetCategoryId: "ft",
        targetSector: "FIRST_TEAM",
      }).allow,
      false,
    );
    assert.equal(
      decideYouthDirectorAthleteCategoryMove({
        role: "YOUTH_DIRECTOR",
        sourceCategoryId: "ft",
        sourceSector: "FIRST_TEAM",
        targetCategoryId: "y1",
        targetSector: "YOUTH",
      }).allow,
      false,
    );
  });

  it("allows YD youth-to-youth and ADMIN any move", () => {
    assert.equal(
      decideYouthDirectorAthleteCategoryMove({
        role: "YOUTH_DIRECTOR",
        sourceCategoryId: "y1",
        sourceSector: "YOUTH",
        targetCategoryId: "y2",
        targetSector: "YOUTH",
      }).allow,
      true,
    );
    assert.equal(
      decideYouthDirectorAthleteCategoryMove({
        role: "ADMIN",
        sourceCategoryId: "ft",
        sourceSector: "FIRST_TEAM",
        targetCategoryId: "y1",
        targetSector: "YOUTH",
      }).allow,
      true,
    );
  });
});

describe("decideYouthDirectorAnnouncementCreate", () => {
  it("YD only CATEGORY_ONLY on YOUTH; denies society-wide and FIRST_TEAM", () => {
    assert.equal(
      decideYouthDirectorAnnouncementCreate({
        role: "YOUTH_DIRECTOR",
        audience: "CATEGORY_ONLY",
        categoryId: "y1",
        sector: "YOUTH",
      }).allow,
      true,
    );
    assert.equal(
      decideYouthDirectorAnnouncementCreate({
        role: "YOUTH_DIRECTOR",
        audience: "ALL",
        categoryId: null,
        sector: null,
      }).allow,
      false,
    );
    assert.equal(
      decideYouthDirectorAnnouncementCreate({
        role: "YOUTH_DIRECTOR",
        audience: "CATEGORY_ONLY",
        categoryId: "ft",
        sector: "FIRST_TEAM",
      }).allow,
      false,
    );
    assert.equal(
      decideYouthDirectorAnnouncementCreate({
        role: "ADMIN",
        audience: "ALL",
        categoryId: null,
        sector: null,
      }).allow,
      true,
    );
  });
});

describe("youth director prisma where fragments", () => {
  it("athlete/media/announcement filters require YOUTH sector", () => {
    assert.deepEqual(youthDirectorAthleteWhere(), { category: { sector: "YOUTH" } });
    assert.deepEqual(youthDirectorMediaItemWhere(), { category: { sector: "YOUTH" } });
    assert.deepEqual(youthDirectorAnnouncementWhere(), {
      categoryId: { not: null },
      category: { sector: "YOUTH" },
    });
  });

  it("parent user/link request filters stay youth-athlete scoped", () => {
    const users = youthDirectorParentUserWhere();
    assert.equal(users.role, "PARENT");
    assert.deepEqual(users.parentProfile, {
      OR: [
        { athletes: { some: { category: { sector: "YOUTH" } } } },
        {
          additionalAthleteLinks: {
            some: { athlete: { category: { sector: "YOUTH" } } },
          },
        },
      ],
    });
    assert.deepEqual(youthDirectorParentLinkRequestWhere(), {
      athlete: { category: { sector: "YOUTH" } },
    });
  });

  it("maps deny codes to safe messages", () => {
    assert.match(
      youthDirectorDataAccessErrorMessage({ allow: false, code: "NOT_YOUTH" }),
      /settore giovanile/i,
    );
  });
});
