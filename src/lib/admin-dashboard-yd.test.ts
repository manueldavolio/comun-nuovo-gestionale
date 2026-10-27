import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  YD_FORBIDDEN_DASHBOARD_HREFS,
  YD_QUICK_LINKS,
  assertYouthDirectorQuickLinksAreAllowed,
  isYouthDirectorDashboardRole,
  shouldRestrictYouthDirectorToAssignedCategories,
  youthDirectorDashboardHasForbiddenHref,
} from "./admin-dashboard-yd";

describe("YOUTH_DIRECTOR dashboard composition", () => {
  it("identifies YD role only", () => {
    assert.equal(isYouthDirectorDashboardRole("YOUTH_DIRECTOR"), true);
    assert.equal(isYouthDirectorDashboardRole("ADMIN"), false);
    assert.equal(isYouthDirectorDashboardRole("COACH"), false);
  });

  it("restricts to assigned categories with the same rule as calendario", () => {
    assert.equal(
      shouldRestrictYouthDirectorToAssignedCategories("YOUTH_DIRECTOR", ["c1"]),
      true,
    );
    assert.equal(
      shouldRestrictYouthDirectorToAssignedCategories("YOUTH_DIRECTOR", []),
      false,
    );
    assert.equal(
      shouldRestrictYouthDirectorToAssignedCategories("ADMIN", ["c1"]),
      false,
    );
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
