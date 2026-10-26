import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoryMatchesSector,
  classifyWeekendCategory,
  displayCategoryLabel,
  formatWeekendVenueLabel,
  resolveOpponentDisplayName,
  weekendBoundsContaining,
} from "@/lib/social-studio/weekend-sectors";

describe("weekend-sectors category mapping", () => {
  it("maps Attività di Base categories", () => {
    assert.equal(classifyWeekendCategory("Primi Calci"), "PRIMI_CALCI");
    assert.equal(classifyWeekendCategory("Pulcini 2017"), "PULCINI_2017");
    assert.equal(classifyWeekendCategory("Pulcini 2016/2017"), "PULCINI_2017");
    assert.equal(classifyWeekendCategory("Pulcini 2018"), null);
    assert.equal(classifyWeekendCategory("Esordienti"), "ESORDIENTI");
    assert.equal(displayCategoryLabel("ESORDIENTI"), "ESORDIENTI");
    assert.equal(categoryMatchesSector("Esordienti", "BASE"), true);
    assert.equal(categoryMatchesSector("Esordienti", "AGONISTICO"), false);
  });

  it("maps Settore Agonistico without years in display", () => {
    assert.equal(classifyWeekendCategory("U15"), "U15");
    assert.equal(classifyWeekendCategory("Under 17"), "U17");
    assert.equal(classifyWeekendCategory("Under 19"), "U19");
    assert.equal(classifyWeekendCategory("Esordienti U15"), "U15");
    assert.equal(classifyWeekendCategory("Giovanissimi U15"), "U15");
    assert.equal(displayCategoryLabel("U15"), "U15");
    assert.equal(categoryMatchesSector("Under 17", "AGONISTICO"), true);
    assert.equal(categoryMatchesSector("Under 17", "BASE"), false);
  });

  it("never invents venue or SEDE N/D", () => {
    const away = formatWeekendVenueLabel({
      isHome: false,
      location: "Gorle centro sportivo",
    });
    assert.equal(away.venueSideLabel, "TRASFERTA");
    assert.equal(away.venueLabel, "Gorle centro sportivo");
    assert.equal(
      formatWeekendVenueLabel({ isHome: false, location: null }).venueLabel,
      "",
    );
    const unknown = formatWeekendVenueLabel({ isHome: null, location: "Via San Zeno" });
    assert.equal(unknown.venueSideLabel, "");
    assert.equal(unknown.venueLabel, "Via San Zeno");
    assert.ok(!unknown.venueSideLabel.includes("SEDE"));
  });

  it("labels home as Casa without inventing institutional address", () => {
    const home = formatWeekendVenueLabel({
      isHome: true,
      location: null,
    });
    assert.equal(home.venueSideLabel, "CASA");
    assert.equal(home.venueLabel, "");
    assert.equal(
      formatWeekendVenueLabel({
        isHome: true,
        location: "Comun Nuovo, via San Zeno",
      }).venueLabel,
      "Comun Nuovo, via San Zeno",
    );
  });

  it("computes Saturday-Sunday weekend bounds", () => {
    const wednesday = new Date(Date.UTC(2026, 9, 21)); // Wed 21 Oct 2026
    const { start, end } = weekendBoundsContaining(wednesday);
    assert.equal(start.toISOString().slice(0, 10), "2026-10-24");
    assert.equal(end.toISOString().slice(0, 10), "2026-10-25");
  });

  it("resolves opponent from title when field is empty", () => {
    assert.equal(
      resolveOpponentDisplayName(null, "Amichevole vs Almè"),
      "Almè",
    );
    assert.equal(resolveOpponentDisplayName("Seriate", "Amichevole vs X"), "Seriate");
  });
});
