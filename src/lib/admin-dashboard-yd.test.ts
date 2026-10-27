import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DASHBOARD_ENROLLMENT_WIDGET_STATUSES,
  YD_FORBIDDEN_DASHBOARD_HREFS,
  YD_QUICK_LINKS,
  announcementWidgetWhereForRole,
  assertYouthDirectorQuickLinksAreAllowed,
  enrollmentWidgetWhereForRole,
  isYouthDirectorDashboardRole,
  shouldRestrictYouthDirectorToAssignedCategories,
  youthDirectorAthleteCategoryFilter,
  youthDirectorDashboardHasForbiddenHref,
  youthDirectorDocumentAthleteFilter,
  youthDirectorUsesYouthSectorEventScope,
} from "./admin-dashboard-yd";
import { youthDirectorAnnouncementWhere } from "./youth-director-data-access-policy";

/** Mirrors Prisma sector filter for dashboard widget regression checks (no DB). */
function matchesEnrollmentWidget(
  role: string,
  athleteSector: "YOUTH" | "FIRST_TEAM" | null,
): boolean {
  const where = enrollmentWidgetWhereForRole(role);
  if (role !== "YOUTH_DIRECTOR") {
    return true;
  }
  const athleteWhere = where.athlete as { category?: { sector?: string } } | undefined;
  return athleteWhere?.category?.sector === "YOUTH" && athleteSector === "YOUTH";
}

function matchesAnnouncementWidget(
  role: string,
  row: { categoryId: string | null; sector: "YOUTH" | "FIRST_TEAM" | null },
): boolean {
  const where = announcementWidgetWhereForRole(role);
  if (!where) {
    return true;
  }
  if (row.categoryId == null) {
    return false;
  }
  const categoryWhere = where.category as { sector?: string } | undefined;
  return categoryWhere?.sector === "YOUTH" && row.sector === "YOUTH";
}

describe("YOUTH_DIRECTOR dashboard composition", () => {
  it("identifies YD role only", () => {
    assert.equal(isYouthDirectorDashboardRole("YOUTH_DIRECTOR"), true);
    assert.equal(isYouthDirectorDashboardRole("ADMIN"), false);
    assert.equal(isYouthDirectorDashboardRole("COACH"), false);
  });

  it("no longer restricts YD events to coach assignments (E0.1d)", () => {
    assert.equal(
      shouldRestrictYouthDirectorToAssignedCategories("YOUTH_DIRECTOR", ["c1"]),
      false,
    );
    assert.equal(
      shouldRestrictYouthDirectorToAssignedCategories("YOUTH_DIRECTOR", []),
      false,
    );
    assert.equal(youthDirectorUsesYouthSectorEventScope("YOUTH_DIRECTOR"), true);
    assert.equal(youthDirectorUsesYouthSectorEventScope("ADMIN"), false);
  });

  it("forbids finance/categories/staff and related admin-only destinations", () => {
    for (const href of YD_FORBIDDEN_DASHBOARD_HREFS) {
      assert.equal(youthDirectorDashboardHasForbiddenHref(href), true);
    }
    assert.equal(youthDirectorDashboardHasForbiddenHref("/admin/finanze?q=1"), true);
    assert.equal(youthDirectorDashboardHasForbiddenHref("/admin/categorie?filter=active"), true);
    assert.equal(youthDirectorDashboardHasForbiddenHref("/admin/atleti"), false);
    assert.equal(youthDirectorDashboardHasForbiddenHref("/admin/documenti"), false);
    assert.equal(youthDirectorDashboardHasForbiddenHref("/admin/visite-mediche"), false);
  });

  it("KPI filters exclude first team by requiring youth category ids only", () => {
    const youthIds = ["youth-a", "youth-b"];
    assert.deepEqual(youthDirectorAthleteCategoryFilter(youthIds), {
      categoryId: { in: youthIds },
    });
    assert.deepEqual(youthDirectorDocumentAthleteFilter(youthIds), {
      athlete: { categoryId: { in: youthIds } },
    });
    assert.deepEqual(youthDirectorAthleteCategoryFilter([]), {
      categoryId: { in: [] },
    });
  });

  it("YD quick links stay within authorized destinations and exclude finance", () => {
    assertYouthDirectorQuickLinksAreAllowed(YD_QUICK_LINKS);
    const hrefs = YD_QUICK_LINKS.map((l) => l.href);
    assert.equal(hrefs.includes("/admin/finanze"), false);
    assert.equal(hrefs.includes("/admin/categorie"), false);
    assert.equal(hrefs.includes("/admin/staff"), false);
    assert.equal(hrefs.includes("/admin/schedina"), false);
    assert.ok(hrefs.includes("/admin/calendario"));
    assert.ok(hrefs.includes("/admin/atleti"));
    assert.ok(hrefs.includes("/admin/associazioni-genitori"));
    assert.ok(hrefs.includes("/admin/utenti"));
    assert.ok(hrefs.includes("/admin/documenti"));
    assert.ok(hrefs.includes("/admin/visite-mediche"));
    const utenti = YD_QUICK_LINKS.find((l) => l.href === "/admin/utenti");
    assert.ok(utenti);
    assert.match(utenti.description.toLowerCase(), /consultazione/);
    assert.equal(utenti.description.toLowerCase().includes("password"), false);
  });
});

describe("dashboard enrollment widget where (BUG-E01F-1)", () => {
  it("YD where requires athlete category sector YOUTH and keeps status filter", () => {
    assert.deepEqual(enrollmentWidgetWhereForRole("YOUTH_DIRECTOR"), {
      status: { in: [...DASHBOARD_ENROLLMENT_WIDGET_STATUSES] },
      athlete: { category: { sector: "YOUTH" } },
    });
  });

  it("ADMIN where stays status-only (unchanged behaviour)", () => {
    assert.deepEqual(enrollmentWidgetWhereForRole("ADMIN"), {
      status: { in: [...DASHBOARD_ENROLLMENT_WIDGET_STATUSES] },
    });
  });

  it("1–3: YD sees YOUTH enrollments; excludes FIRST_TEAM and null sector", () => {
    assert.equal(matchesEnrollmentWidget("YOUTH_DIRECTOR", "YOUTH"), true);
    assert.equal(matchesEnrollmentWidget("YOUTH_DIRECTOR", "FIRST_TEAM"), false);
    assert.equal(matchesEnrollmentWidget("YOUTH_DIRECTOR", null), false);
  });

  it("6: ADMIN still matches all sector rows for the widget filter shape", () => {
    assert.equal(matchesEnrollmentWidget("ADMIN", "YOUTH"), true);
    assert.equal(matchesEnrollmentWidget("ADMIN", "FIRST_TEAM"), true);
    assert.equal(matchesEnrollmentWidget("ADMIN", null), true);
  });
});

describe("dashboard announcement widget where (BUG-E01F-2)", () => {
  it("YD reuses youthDirectorAnnouncementWhere()", () => {
    assert.deepEqual(
      announcementWidgetWhereForRole("YOUTH_DIRECTOR"),
      youthDirectorAnnouncementWhere(),
    );
    assert.deepEqual(announcementWidgetWhereForRole("YOUTH_DIRECTOR"), {
      categoryId: { not: null },
      category: { sector: "YOUTH" },
    });
  });

  it("ADMIN keeps unfiltered widget (undefined where)", () => {
    assert.equal(announcementWidgetWhereForRole("ADMIN"), undefined);
  });

  it("4–5: YD sees YOUTH announcements; excludes FIRST_TEAM and society-wide", () => {
    assert.equal(
      matchesAnnouncementWidget("YOUTH_DIRECTOR", {
        categoryId: "youth-cat",
        sector: "YOUTH",
      }),
      true,
    );
    assert.equal(
      matchesAnnouncementWidget("YOUTH_DIRECTOR", {
        categoryId: "ft-cat",
        sector: "FIRST_TEAM",
      }),
      false,
    );
    assert.equal(
      matchesAnnouncementWidget("YOUTH_DIRECTOR", {
        categoryId: null,
        sector: null,
      }),
      false,
    );
  });

  it("6: ADMIN still sees YOUTH, FIRST_TEAM and general announcements", () => {
    assert.equal(
      matchesAnnouncementWidget("ADMIN", { categoryId: "youth-cat", sector: "YOUTH" }),
      true,
    );
    assert.equal(
      matchesAnnouncementWidget("ADMIN", { categoryId: "ft-cat", sector: "FIRST_TEAM" }),
      true,
    );
    assert.equal(
      matchesAnnouncementWidget("ADMIN", { categoryId: null, sector: null }),
      true,
    );
  });
});

