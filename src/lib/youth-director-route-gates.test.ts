import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideAdminOnlyAthleteMutation,
  decideAnnouncementCreateAccess,
  decideAnnouncementDeleteAccess,
  decideAthleteCategoryMoveApiAccess,
  decideAthleteScopedAdminDataAccess,
  decideAuthenticatedAdminOrYouthDirector,
  decideMedicalCertificateUploadAccess,
  decideMediaCreateAccess,
  decideMisterAthleteMutationAccess,
  decideParentLinkRequestAccess,
  decideResourceOwnedByAthleteAccess,
  gateAllowsWrite,
} from "@/lib/youth-director-route-gates";

describe("anonymous and role gates", () => {
  it("rejects anonymous before any admin/YD operation", () => {
    const r = decideAuthenticatedAdminOrYouthDirector({
      authenticated: false,
      role: null,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 401);
      assert.equal(r.write, false);
      assert.equal(gateAllowsWrite(r), false);
    }
  });

  it("rejects PARENT/COACH on admin athlete-data routes", () => {
    for (const role of ["PARENT", "COACH", "SOCIAL_MEDIA_MANAGER"]) {
      const r = decideAuthenticatedAdminOrYouthDirector({
        authenticated: true,
        role,
      });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.status, 403);
    }
  });

  it("ADMIN-only athlete mutations stay ADMIN-only (YD denied)", () => {
    assert.equal(
      decideAdminOnlyAthleteMutation({ authenticated: true, role: "YOUTH_DIRECTOR" }).ok,
      false,
    );
    assert.equal(
      decideAdminOnlyAthleteMutation({ authenticated: true, role: "ADMIN" }).ok,
      true,
    );
    assert.equal(
      decideAdminOnlyAthleteMutation({ authenticated: false, role: "ADMIN" }).ok,
      false,
    );
  });
});

describe("athlete-scoped medical/documents/enrollment", () => {
  it("YD allowed on YOUTH; denied FIRST_TEAM / NULL / missing / no athlete", () => {
    assert.equal(
      decideAthleteScopedAdminDataAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        athleteExists: true,
        categoryId: "y1",
        categorySector: "YOUTH",
      }).ok,
      true,
    );

    for (const bad of [
      { categoryId: "ft", categorySector: "FIRST_TEAM" as const },
      { categoryId: "u", categorySector: null },
      { categoryId: "x", categorySector: "MISSING" as const },
      { categoryId: null, categorySector: "YOUTH" as const },
    ]) {
      const r = decideAthleteScopedAdminDataAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        athleteExists: true,
        ...bad,
      });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.status, 403);
        assert.equal(r.write, false);
      }
    }

    const missing = decideAthleteScopedAdminDataAccess({
      authenticated: true,
      role: "YOUTH_DIRECTOR",
      athleteExists: false,
      categoryId: null,
      categorySector: "MISSING",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 404);
  });

  it("ADMIN unchanged on FIRST_TEAM resources by id", () => {
    assert.equal(
      decideResourceOwnedByAthleteAccess({
        authenticated: true,
        role: "ADMIN",
        resourceExists: true,
        athleteExists: true,
        categoryId: "ft",
        categorySector: "FIRST_TEAM",
      }).ok,
      true,
    );
    const yd = decideResourceOwnedByAthleteAccess({
      authenticated: true,
      role: "YOUTH_DIRECTOR",
      resourceExists: true,
      athleteExists: true,
      categoryId: "ft",
      categorySector: "FIRST_TEAM",
    });
    assert.equal(yd.ok, false);
    if (!yd.ok) assert.equal(yd.write, false);
  });
});

describe("certificate upload gate (no write when denied)", () => {
  it("requires athleteId and denies FIRST_TEAM for YD without write", () => {
    const noAthlete = decideMedicalCertificateUploadAccess({
      authenticated: true,
      role: "YOUTH_DIRECTOR",
      athleteId: null,
      athleteExists: false,
      categoryId: null,
      categorySector: "MISSING",
    });
    assert.equal(noAthlete.ok, false);
    if (!noAthlete.ok) {
      assert.equal(noAthlete.status, 400);
      assert.equal(noAthlete.write, false);
    }

    const ft = decideMedicalCertificateUploadAccess({
      authenticated: true,
      role: "YOUTH_DIRECTOR",
      athleteId: "a-ft",
      athleteExists: true,
      categoryId: "ft",
      categorySector: "FIRST_TEAM",
    });
    assert.equal(ft.ok, false);
    if (!ft.ok) {
      assert.equal(ft.status, 403);
      assert.equal(ft.write, false);
      assert.equal(gateAllowsWrite(ft), false);
    }

    assert.equal(
      decideMedicalCertificateUploadAccess({
        authenticated: true,
        role: "ADMIN",
        athleteId: "a-ft",
        athleteExists: true,
        categoryId: "ft",
        categorySector: "FIRST_TEAM",
      }).ok,
      true,
    );

    assert.equal(
      decideMedicalCertificateUploadAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        athleteId: "a-y",
        athleteExists: true,
        categoryId: "y1",
        categorySector: "YOUTH",
      }).ok,
      true,
    );
  });
});

describe("announcements and media", () => {
  it("YD cannot create or delete society-wide / FIRST_TEAM communications", () => {
    assert.equal(
      decideAnnouncementCreateAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        audience: "ALL",
        categoryId: null,
        categorySector: "MISSING",
      }).ok,
      false,
    );
    assert.equal(
      decideAnnouncementCreateAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        audience: "CATEGORY_ONLY",
        categoryId: "y1",
        categorySector: "YOUTH",
      }).ok,
      true,
    );
    assert.equal(
      decideAnnouncementDeleteAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        announcementExists: true,
        categoryId: null,
        categorySector: "MISSING",
      }).ok,
      false,
    );
    assert.equal(
      decideAnnouncementDeleteAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        announcementExists: true,
        categoryId: "ft",
        categorySector: "FIRST_TEAM",
      }).ok,
      false,
    );
    assert.equal(
      decideAnnouncementCreateAccess({
        authenticated: true,
        role: "ADMIN",
        audience: "ALL",
        categoryId: null,
        categorySector: "MISSING",
      }).ok,
      true,
    );
  });

  it("YD media create denied for FIRST_TEAM and null sector; COACH assignment unchanged", () => {
    assert.equal(
      decideMediaCreateAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        categoryId: "ft",
        categoryExists: true,
        categorySector: "FIRST_TEAM",
        coachAssignedToCategory: false,
      }).ok,
      false,
    );
    assert.equal(
      decideMediaCreateAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        categoryId: "u",
        categoryExists: true,
        categorySector: null,
        coachAssignedToCategory: false,
      }).ok,
      false,
    );
    assert.equal(
      decideMediaCreateAccess({
        authenticated: true,
        role: "COACH",
        categoryId: "ft",
        categoryExists: true,
        categorySector: "FIRST_TEAM",
        coachAssignedToCategory: true,
      }).ok,
      true,
    );
    assert.equal(
      decideMediaCreateAccess({
        authenticated: true,
        role: "COACH",
        categoryId: "ft",
        categoryExists: true,
        categorySector: "FIRST_TEAM",
        coachAssignedToCategory: false,
      }).ok,
      false,
    );
  });
});

describe("parent link requests and mister athlete APIs", () => {
  it("YD link-request review denied for FIRST_TEAM athlete id", () => {
    const r = decideParentLinkRequestAccess({
      authenticated: true,
      role: "YOUTH_DIRECTOR",
      requestExists: true,
      athleteExists: true,
      categoryId: "ft",
      categorySector: "FIRST_TEAM",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.write, false);
  });

  it("mister athlete mutation: YD YOUTH ok, FIRST_TEAM denied; COACH assignment; PARENT denied", () => {
    assert.equal(
      decideMisterAthleteMutationAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        athleteExists: true,
        categoryId: "y1",
        categorySector: "YOUTH",
        coachAssignedToCategory: false,
      }).ok,
      true,
    );
    assert.equal(
      decideMisterAthleteMutationAccess({
        authenticated: true,
        role: "YOUTH_DIRECTOR",
        athleteExists: true,
        categoryId: "ft",
        categorySector: "FIRST_TEAM",
        coachAssignedToCategory: false,
      }).ok,
      false,
    );
    assert.equal(
      decideMisterAthleteMutationAccess({
        authenticated: true,
        role: "COACH",
        athleteExists: true,
        categoryId: "c1",
        categorySector: "YOUTH",
        coachAssignedToCategory: false,
      }).ok,
      false,
    );
    assert.equal(
      decideMisterAthleteMutationAccess({
        authenticated: true,
        role: "PARENT",
        athleteExists: true,
        categoryId: "y1",
        categorySector: "YOUTH",
        coachAssignedToCategory: false,
      }).ok,
      false,
    );
  });

  it("category move API remains ADMIN-only even if YOUTH→YOUTH would be policy-ok", () => {
    const yd = decideAthleteCategoryMoveApiAccess({
      authenticated: true,
      role: "YOUTH_DIRECTOR",
      sourceCategoryId: "y1",
      sourceSector: "YOUTH",
      targetCategoryId: "y2",
      targetSector: "YOUTH",
    });
    assert.equal(yd.ok, false);
    if (!yd.ok) assert.equal(yd.write, false);

    assert.equal(
      decideAthleteCategoryMoveApiAccess({
        authenticated: true,
        role: "ADMIN",
        sourceCategoryId: "ft",
        sourceSector: "FIRST_TEAM",
        targetCategoryId: "y1",
        targetSector: "YOUTH",
      }).ok,
      true,
    );
  });
});
