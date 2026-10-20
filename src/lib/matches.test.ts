import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideCoachMatchAccess,
  decideParentMatchAccess,
  filterConvocationsForAudience,
  filterRatingsForAudience,
  inferMatchScheduleHint,
  matchPassesFilter,
  resolveMatchLifecycleStatus,
  sortMatchesForFilter,
  isParentVisibleCardType,
} from "./matches";

describe("matches lifecycle", () => {
  const now = new Date("2026-10-20T12:00:00Z");

  it("detects postponed/cancelled hints from title", () => {
    assert.equal(inferMatchScheduleHint("Partita rinviata"), "POSTPONED");
    assert.equal(inferMatchScheduleHint("Gara annullata"), "CANCELLED");
    assert.equal(inferMatchScheduleHint("vs Virtus"), null);
  });

  it("resolves upcoming / played / no_result", () => {
    assert.equal(
      resolveMatchLifecycleStatus({
        startAt: new Date("2026-10-21T15:00:00Z"),
        homeScore: null,
        awayScore: null,
        title: "vs A",
        wallNow: now,
      }),
      "UPCOMING",
    );
    assert.equal(
      resolveMatchLifecycleStatus({
        startAt: new Date("2026-10-18T15:00:00Z"),
        homeScore: 2,
        awayScore: 1,
        title: "vs A",
        wallNow: now,
      }),
      "PLAYED",
    );
    assert.equal(
      resolveMatchLifecycleStatus({
        startAt: new Date("2026-10-18T15:00:00Z"),
        homeScore: null,
        awayScore: null,
        title: "vs A",
        wallNow: now,
      }),
      "NO_RESULT",
    );
  });

  it("filters upcoming vs played", () => {
    const upcoming = resolveMatchLifecycleStatus({
      startAt: new Date("2026-10-25T10:00:00Z"),
      homeScore: null,
      awayScore: null,
      title: "x",
      wallNow: now,
    });
    const played = resolveMatchLifecycleStatus({
      startAt: new Date("2026-10-10T10:00:00Z"),
      homeScore: 1,
      awayScore: 0,
      title: "x",
      wallNow: now,
    });
    assert.equal(
      matchPassesFilter(upcoming, new Date("2026-10-25T10:00:00Z"), now, "upcoming"),
      true,
    );
    assert.equal(
      matchPassesFilter(played, new Date("2026-10-10T10:00:00Z"), now, "upcoming"),
      false,
    );
    assert.equal(
      matchPassesFilter(played, new Date("2026-10-10T10:00:00Z"), now, "played"),
      true,
    );
  });

  it("sorts played descending and upcoming ascending", () => {
    const rows = [
      { id: "a", startAt: new Date("2026-10-01T10:00:00Z") },
      { id: "b", startAt: new Date("2026-10-15T10:00:00Z") },
    ];
    assert.equal(sortMatchesForFilter(rows, "played")[0]?.id, "b");
    assert.equal(sortMatchesForFilter(rows, "upcoming")[0]?.id, "a");
  });

  it("limits parent-visible card types", () => {
    assert.equal(isParentVisibleCardType("YELLOW_CARD"), true);
    assert.equal(isParentVisibleCardType("DIRECT_SUSPENSION"), false);
  });

  it("gates coach and parent match access", () => {
    assert.equal(
      decideCoachMatchAccess({
        authenticated: true,
        role: "COACH",
        categoryAssigned: true,
      }).ok,
      true,
    );
    assert.equal(
      decideCoachMatchAccess({
        authenticated: true,
        role: "COACH",
        categoryAssigned: false,
      }).ok,
      false,
    );
    assert.equal(
      decideParentMatchAccess({
        authenticated: true,
        role: "PARENT",
        childInCategory: true,
      }).ok,
      true,
    );
    assert.equal(
      decideParentMatchAccess({
        authenticated: true,
        role: "PARENT",
        childInCategory: false,
      }).ok,
      false,
    );
  });

  it("filters parent ratings and convocations to own children", () => {
    const rows = [{ athleteId: "a1" }, { athleteId: "a2" }];
    const allowed = new Set(["a1"]);
    assert.deepEqual(filterRatingsForAudience(rows, "parent", allowed), [
      { athleteId: "a1" },
    ]);
    assert.deepEqual(filterConvocationsForAudience(rows, "parent", allowed), [
      { athleteId: "a1" },
    ]);
    assert.deepEqual(filterRatingsForAudience(rows, "coach", null), rows);
  });
});
