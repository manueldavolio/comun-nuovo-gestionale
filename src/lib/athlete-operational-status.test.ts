import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  endOfWallClockDayFromDateInput,
  endOfWallClockDayFromWallNow,
  isOperationalStatusExpired,
  isOperationalStatusType,
  normalizeOperationalNote,
  resolveOperationalStatus,
  summarizeAvailability,
} from "./athlete-operational-status";
import { buildMisterTodos } from "./mister-todo";

describe("athlete operational status", () => {
  const wallNow = new Date(Date.UTC(2026, 9, 6, 15, 30, 0)); // 6 Oct 2026 15:30

  it("defaults to AVAILABLE when no record", () => {
    const resolved = resolveOperationalStatus({ record: null, wallNow });
    assert.equal(resolved.status, "AVAILABLE");
    assert.equal(resolved.isDefaultAvailable, true);
    assert.equal(resolved.hasActiveRecord, false);
  });

  it("resolves active statuses and note", () => {
    for (const status of ["TO_CHECK", "INJURED", "ILL", "ABSENT"] as const) {
      const resolved = resolveOperationalStatus({
        record: { status, note: "  Da verificare  ", validUntil: null },
        wallNow,
      });
      assert.equal(resolved.status, status);
      assert.equal(resolved.note, "Da verificare");
      assert.equal(resolved.hasActiveRecord, true);
    }
  });

  it("treats expired validUntil as AVAILABLE without mutating", () => {
    const expired = new Date(Date.UTC(2026, 9, 5, 23, 59, 59, 999));
    const resolved = resolveOperationalStatus({
      record: { status: "INJURED", note: "Non disponibile", validUntil: expired },
      wallNow,
    });
    assert.equal(resolved.status, "AVAILABLE");
    assert.equal(resolved.note, null);
    assert.equal(resolved.isDefaultAvailable, true);
    assert.equal(isOperationalStatusExpired(expired, wallNow), true);
  });

  it("keeps status until end of Europe/Rome wall-clock day", () => {
    const validUntil = endOfWallClockDayFromDateInput("2026-10-06");
    assert.ok(validUntil);
    assert.equal(validUntil.toISOString(), "2026-10-06T23:59:59.999Z");
    assert.equal(isOperationalStatusExpired(validUntil, wallNow), false);

    const afterDay = new Date(Date.UTC(2026, 9, 7, 0, 0, 0, 0));
    assert.equal(isOperationalStatusExpired(validUntil, afterDay), true);

    const todayEnd = endOfWallClockDayFromWallNow(wallNow, 0);
    const tomorrowEnd = endOfWallClockDayFromWallNow(wallNow, 1);
    assert.equal(todayEnd.toISOString(), "2026-10-06T23:59:59.999Z");
    assert.equal(tomorrowEnd.toISOString(), "2026-10-07T23:59:59.999Z");
  });

  it("summarizes availability counts", () => {
    const summary = summarizeAvailability([
      { status: "AVAILABLE" },
      { status: "AVAILABLE" },
      { status: "TO_CHECK" },
      { status: "INJURED" },
      { status: "ILL" },
      { status: "ABSENT" },
    ]);
    assert.deepEqual(summary, {
      total: 6,
      available: 2,
      toCheck: 1,
      unavailable: 3,
    });
  });

  it("rejects invalid status and long notes", () => {
    assert.equal(isOperationalStatusType("INJURED"), true);
    assert.equal(isOperationalStatusType("SICK"), false);
    assert.equal(normalizeOperationalNote("ok").ok, true);
    const long = normalizeOperationalNote("x".repeat(161));
    assert.equal(long.ok, false);
  });
});

describe("mister todos", () => {
  const wallNow = new Date(Date.UTC(2026, 9, 6, 12, 0, 0));

  it("builds high/medium/soft tasks from real gaps only", () => {
    const todos = buildMisterTodos({
      wallNow,
      allowedCategoryIds: ["cat-a"],
      pastEvents: [
        {
          id: "m1",
          type: "LEAGUE_MATCH",
          title: "vs Paladina",
          startAt: new Date(Date.UTC(2026, 9, 4, 15, 0, 0)),
          endAt: new Date(Date.UTC(2026, 9, 4, 17, 0, 0)),
          categoryId: "cat-a",
          categoryName: "Under 15",
          opponentName: "Paladina",
          homeScore: null,
          awayScore: null,
          isHome: true,
          attendanceCount: 0,
          playerGoalsSum: 0,
        },
        {
          id: "m2",
          type: "LEAGUE_MATCH",
          title: "vs Osio",
          startAt: new Date(Date.UTC(2026, 9, 3, 15, 0, 0)),
          endAt: new Date(Date.UTC(2026, 9, 3, 17, 0, 0)),
          categoryId: "cat-a",
          categoryName: "Under 15",
          opponentName: "Osio",
          homeScore: 2,
          awayScore: 0,
          isHome: true,
          attendanceCount: 12,
          playerGoalsSum: 0,
        },
        {
          id: "t1",
          type: "TRAINING",
          title: "Allenamento",
          startAt: new Date(Date.UTC(2026, 9, 5, 18, 0, 0)),
          endAt: null,
          categoryId: "cat-a",
          opponentName: null,
          homeScore: null,
          awayScore: null,
          isHome: null,
          attendanceCount: 0,
          playerGoalsSum: 0,
        },
        {
          id: "complete-00",
          type: "FRIENDLY",
          title: "vs Test",
          startAt: new Date(Date.UTC(2026, 9, 2, 15, 0, 0)),
          endAt: new Date(Date.UTC(2026, 9, 2, 17, 0, 0)),
          categoryId: "cat-a",
          opponentName: "Test",
          homeScore: 0,
          awayScore: 0,
          isHome: true,
          attendanceCount: 10,
          playerGoalsSum: 0,
        },
      ],
      futureMatches: [
        {
          id: "future-1",
          title: "vs Future",
          type: "LEAGUE_MATCH",
          startAt: new Date(Date.UTC(2026, 9, 10, 15, 0, 0)),
          opponentName: "Future",
          hasConvocation: false,
          pendingRsvpCount: 0,
        },
        {
          id: "future-2",
          title: "vs Near",
          type: "LEAGUE_MATCH",
          startAt: new Date(Date.UTC(2026, 9, 8, 15, 0, 0)),
          opponentName: "Near",
          hasConvocation: true,
          pendingRsvpCount: 3,
        },
        {
          id: "future-far",
          title: "vs Far",
          type: "LEAGUE_MATCH",
          startAt: new Date(Date.UTC(2026, 10, 20, 15, 0, 0)),
          opponentName: "Far",
          hasConvocation: false,
          pendingRsvpCount: 0,
        },
      ],
      athletes: [
        { athleteId: "a1", hasCurrentMonthNote: false, activeGoalCount: 0 },
        { athleteId: "a2", hasCurrentMonthNote: true, activeGoalCount: 1 },
        { athleteId: "a3", hasCurrentMonthNote: false, activeGoalCount: 0 },
      ],
    });

    const kinds = todos.map((todo) => todo.kind);
    assert.ok(kinds.includes("MISSING_ATTENDANCE"));
    assert.ok(kinds.includes("MISSING_RESULT"));
    assert.ok(kinds.includes("SOFT_STATS"));
    assert.ok(kinds.includes("PREPARE_CONVOCATION"));
    assert.ok(kinds.includes("PENDING_RSVP"));
    assert.ok(kinds.includes("MISSING_COACH_NOTES"));
    assert.ok(kinds.includes("SUGGEST_GOALS"));
    assert.equal(kinds.includes("PREPARE_CONVOCATION") && todos.some((t) => t.eventId === "future-far"), false);

    const softStats = todos.find((todo) => todo.kind === "SOFT_STATS");
    assert.equal(softStats?.href, "/mister/eventi/m2/presenze");

    const notes = todos.find((todo) => todo.kind === "MISSING_COACH_NOTES");
    assert.equal(notes?.count, 2);
    assert.equal(notes?.href, "/mister/squadra");

    const goals = todos.find((todo) => todo.kind === "SUGGEST_GOALS");
    assert.equal(goals?.priority, "suggestion");
    assert.equal(goals?.count, 2);
  });

  it("returns empty when data are complete", () => {
    const todos = buildMisterTodos({
      wallNow,
      allowedCategoryIds: ["cat-a"],
      pastEvents: [
        {
          id: "ok",
          type: "LEAGUE_MATCH",
          title: "vs Ok",
          startAt: new Date(Date.UTC(2026, 9, 4, 15, 0, 0)),
          endAt: new Date(Date.UTC(2026, 9, 4, 17, 0, 0)),
          categoryId: "cat-a",
          opponentName: "Ok",
          homeScore: 0,
          awayScore: 0,
          isHome: true,
          attendanceCount: 11,
          playerGoalsSum: 0,
        },
      ],
      futureMatches: [
        {
          id: "f",
          title: "vs Ready",
          type: "LEAGUE_MATCH",
          startAt: new Date(Date.UTC(2026, 9, 8, 15, 0, 0)),
          opponentName: "Ready",
          hasConvocation: true,
          pendingRsvpCount: 0,
        },
      ],
      athletes: [{ athleteId: "a1", hasCurrentMonthNote: true, activeGoalCount: 2 }],
    });
    assert.equal(todos.length, 0);
  });

  it("does not invent training absence when attendance exists", () => {
    const todos = buildMisterTodos({
      wallNow,
      allowedCategoryIds: ["cat-a"],
      pastEvents: [
        {
          id: "t-ok",
          type: "TRAINING",
          title: "Allenamento",
          startAt: new Date(Date.UTC(2026, 9, 5, 18, 0, 0)),
          endAt: null,
          categoryId: "cat-a",
          opponentName: null,
          homeScore: null,
          awayScore: null,
          isHome: null,
          attendanceCount: 14,
          playerGoalsSum: 0,
        },
      ],
      futureMatches: [],
      athletes: [],
    });
    assert.equal(todos.length, 0);
  });
});
