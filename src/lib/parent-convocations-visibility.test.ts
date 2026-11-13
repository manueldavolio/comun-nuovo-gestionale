import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  PARENT_CONVOCATIONS_HISTORY_TAKE,
  mergeParentConvocationEntriesForDisplay,
  parentPastEventWhere,
  parentUpcomingEventWhere,
  upcomingIdsDroppedByOldestTake,
} from "./parent-convocations-visibility";

describe("parent convocations visibility helpers", () => {
  const wallNow = new Date("2026-11-13T10:00:00.000Z");

  it("builds upcoming/past event filters for null and non-null endAt", () => {
    const upcoming = parentUpcomingEventWhere(wallNow);
    const past = parentPastEventWhere(wallNow);
    assert.ok(upcoming.OR);
    assert.ok(past.OR);
  });

  it("keeps all upcoming when merging with capped historical list", () => {
    const upcoming = Array.from({ length: 5 }, (_, index) => ({
      id: `up-${index}`,
      startAt: new Date(`2026-11-${14 + index}T15:00:00.000Z`),
    }));
    const recentHistorical = Array.from({ length: PARENT_CONVOCATIONS_HISTORY_TAKE }, (_, index) => ({
      id: `past-${index}`,
      startAt: new Date(Date.UTC(2025, 0, 1 + (index % 28))),
    }));

    const merged = mergeParentConvocationEntriesForDisplay({
      upcoming,
      recentHistorical,
    });

    assert.equal(merged.length, 5 + PARENT_CONVOCATIONS_HISTORY_TAKE);
    for (const entry of upcoming) {
      assert.ok(merged.some((row) => row.id === entry.id));
    }
    assert.equal(merged[0]?.id, "up-0");
  });

  it("dedupes ids preferring upcoming order", () => {
    const merged = mergeParentConvocationEntriesForDisplay({
      upcoming: [{ id: "same" }, { id: "a" }],
      recentHistorical: [{ id: "same" }, { id: "b" }],
    });
    assert.deepEqual(
      merged.map((row) => row.id),
      ["same", "a", "b"],
    );
  });

  it("documents the old asc+take 150 bug with >150 historical and recent upcoming", () => {
    const historical = Array.from({ length: 160 }, (_, index) => ({
      id: `old-${index}`,
      startAt: new Date(Date.UTC(2024, 0, 1 + index)),
    }));
    const upcoming = [
      { id: "future-1", startAt: new Date("2026-11-14T15:30:00.000Z") },
      { id: "future-2", startAt: new Date("2026-11-21T15:30:00.000Z") },
    ];
    const dropped = upcomingIdsDroppedByOldestTake({
      entries: [...historical, ...upcoming],
      take: 150,
      wallNow,
    });
    assert.deepEqual(dropped.sort(), ["future-1", "future-2"]);

    const fixed = mergeParentConvocationEntriesForDisplay({
      upcoming,
      recentHistorical: historical
        .slice()
        .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
        .slice(0, PARENT_CONVOCATIONS_HISTORY_TAKE),
    });
    assert.ok(fixed.some((row) => row.id === "future-1"));
    assert.ok(fixed.some((row) => row.id === "future-2"));
    assert.equal(
      fixed.filter((row) => row.id.startsWith("old-")).length,
      PARENT_CONVOCATIONS_HISTORY_TAKE,
    );
  });

  it("single-child and multi-child upcoming lists remain fully visible after merge", () => {
    const childAUpcoming = [{ id: "a-future", startAt: new Date("2026-11-14T15:00:00.000Z") }];
    const childBOnlySelectedElsewhere = [
      { id: "b-past", startAt: new Date("2026-10-01T15:00:00.000Z") },
    ];
    const merged = mergeParentConvocationEntriesForDisplay({
      upcoming: childAUpcoming,
      recentHistorical: childBOnlySelectedElsewhere,
    });
    assert.ok(merged.some((row) => row.id === "a-future"));
  });
});

describe("parent convocations page / dashboard source guards", () => {
  const root = process.cwd();

  it("convocazioni page loads upcoming separately and caps only historical", () => {
    const source = readFileSync(
      path.join(root, "src/app/genitore/convocazioni/page.tsx"),
      "utf8",
    );
    assert.match(source, /parentUpcomingEventWhere/);
    assert.match(source, /parentPastEventWhere/);
    assert.match(source, /PARENT_CONVOCATIONS_HISTORY_TAKE/);
    assert.match(source, /mergeParentConvocationEntriesForDisplay/);
    assert.match(source, /athletesAssociatedToParentWhere/);
    assert.doesNotMatch(
      source,
      /orderBy:\s*\{\s*convocation:\s*\{\s*event:\s*\{\s*startAt:\s*"asc",\s*\},\s*\},\s*\},\s*take:\s*150/,
    );
  });

  it("dashboard pending count uses all associated athletes and links to convocazioni", () => {
    const source = readFileSync(path.join(root, "src/app/genitore/page.tsx"), "utf8");
    assert.match(
      source,
      /athlete:\s*athletesAssociatedToParentWhere\(parentProfile\.id\)/,
    );
    assert.match(source, /href="\/genitore\/convocazioni"/);
    assert.match(source, /Include tutti i figli collegati/);
    assert.doesNotMatch(
      source,
      /prisma\.convocationAthlete\.count\(\{\s*where:\s*\{\s*athleteId:\s*selectedAthlete\.id/,
    );
  });
});
