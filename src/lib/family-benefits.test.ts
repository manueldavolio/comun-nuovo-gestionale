import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFamilyBenefitVisibleToAudience,
  resolveBenefitAudienceBucket,
  sortFamilyBenefits,
} from "./family-benefits";
import {
  findVerifiedCompetitionHint,
  isAllowedTuttocampoWidgetUrl,
  isBaseActivityCategory,
  parseManualStandingsJson,
  showsCompetitiveStandings,
} from "./team-competition";

describe("family benefits audience", () => {
  it("maps category to audience buckets", () => {
    assert.equal(
      resolveBenefitAudienceBucket({ categoryName: "Prima Squadra", sector: "FIRST_TEAM" }),
      "FIRST_TEAM",
    );
    assert.equal(
      resolveBenefitAudienceBucket({ categoryName: "Primi calci", sector: "YOUTH" }),
      "BASE_ACTIVITY",
    );
    assert.equal(
      resolveBenefitAudienceBucket({ categoryName: "Under 17", sector: "YOUTH" }),
      "YOUTH",
    );
  });

  it("hides unpublished/expired and filters audience", () => {
    const now = new Date("2026-10-30T10:00:00.000Z");
    assert.equal(
      isFamilyBenefitVisibleToAudience({
        audience: "ALL",
        isPublished: true,
        isActive: true,
        expiresAt: null,
        now,
        viewer: { categoryName: "Pulcini", sector: "YOUTH" },
      }),
      true,
    );
    assert.equal(
      isFamilyBenefitVisibleToAudience({
        audience: "FIRST_TEAM",
        isPublished: true,
        isActive: true,
        expiresAt: null,
        now,
        viewer: { categoryName: "Pulcini", sector: "YOUTH" },
      }),
      false,
    );
    assert.equal(
      isFamilyBenefitVisibleToAudience({
        audience: "ALL",
        isPublished: true,
        isActive: true,
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        now,
        viewer: { categoryName: "Pulcini", sector: "YOUTH" },
      }),
      false,
    );
  });

  it("sorts by priority then sortOrder", () => {
    const sorted = sortFamilyBenefits([
      { name: "B", priority: 1, sortOrder: 2 },
      { name: "A", priority: 5, sortOrder: 9 },
      { name: "C", priority: 1, sortOrder: 1 },
    ]);
    assert.deepEqual(
      sorted.map((r) => r.name),
      ["A", "C", "B"],
    );
  });
});

describe("team competition sources", () => {
  it("detects base activity without competitive standings", () => {
    assert.equal(isBaseActivityCategory("Primi calci"), true);
    assert.equal(showsCompetitiveStandings("Primi calci", "YOUTH"), false);
    assert.equal(showsCompetitiveStandings("Under 15", "YOUTH"), true);
    assert.equal(showsCompetitiveStandings("Prima Squadra", "FIRST_TEAM"), true);
  });

  it("returns verified 2026/27 hints without inventing widget ids", () => {
    const prima = findVerifiedCompetitionHint("Prima Squadra");
    assert.ok(prima);
    assert.equal(prima.groupLabel, "Girone L");
    assert.match(prima.sourcePageUrl ?? "", /PrimaCategoria\/GironeL/);

    const u17 = findVerifiedCompetitionHint("Under 17");
    assert.equal(u17?.groupLabel, "Girone C");
    assert.equal(u17?.sourcePageUrl, null);

    const u19 = findVerifiedCompetitionHint("Under 19");
    assert.equal(u19?.groupLabel, "Girone A");
  });

  it("allows only official Tuttocampo widget https URLs", () => {
    assert.equal(
      isAllowedTuttocampoWidgetUrl(
        "https://www.tuttocampo.it/WidgetV2/Classifica/570ce2a7-5474-11e4-b2c1-448a5b2c3468",
      ),
      true,
    );
    assert.equal(isAllowedTuttocampoWidgetUrl("https://evil.example/WidgetV2/x"), false);
    assert.equal(isAllowedTuttocampoWidgetUrl("http://www.tuttocampo.it/WidgetV2/x"), false);
  });

  it("parses manual standings JSON", () => {
    const rows = parseManualStandingsJson(
      JSON.stringify([
        { pos: 2, team: "B", points: 6 },
        { pos: 1, team: "A", points: 9 },
      ]),
    );
    assert.equal(rows?.[0]?.team, "A");
    assert.equal(parseManualStandingsJson("{bad"), null);
  });
});
