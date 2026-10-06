import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRecentMatchChips,
  computeMyComunAchievements,
  longestPresentStreak,
} from "./achievements";
import {
  buildAthleteWeekRows,
  formatWeekEventDateLabel,
  myComunWeekBounds,
  resolveAthleteWeekCompleted,
  summarizeWeekTrainings,
} from "./week";
import { buildAthleteGrowthPath } from "./achievements";
import { computeSeasonAthleteStats } from "@/lib/parent-season";
import { athleteInitials } from "@/lib/parent-season";

describe("my-comun-nuovo week (Europe/Rome wall-clock)", () => {
  it("bounds week Monday–Sunday around a Wednesday", () => {
    // Wednesday 8 Oct 2025 12:00 wall-clock stored as UTC date fields
    const wallNow = new Date(Date.UTC(2025, 9, 8, 12, 0, 0));
    const { start, end } = myComunWeekBounds(wallNow);
    assert.equal(start.toISOString(), "2025-10-06T00:00:00.000Z");
    assert.equal(end.toISOString(), "2025-10-12T23:59:59.999Z");
  });

  it("formats weekday labels from wall-clock UTC fields", () => {
    assert.equal(formatWeekEventDateLabel(new Date(Date.UTC(2025, 9, 7, 18, 0))), "MAR 7 OTT");
    assert.equal(formatWeekEventDateLabel(new Date(Date.UTC(2025, 9, 11, 15, 30))), "SAB 11 OTT");
  });

  it("does not invent attendance for future events", () => {
    const wallNow = new Date(Date.UTC(2025, 9, 8, 12, 0, 0));
    const rows = buildAthleteWeekRows({
      wallNow,
      events: [
        {
          id: "past",
          type: "TRAINING",
          title: "Allenamento",
          startAt: new Date(Date.UTC(2025, 9, 7, 18, 0)),
          attendanceStatus: "PRESENT",
        },
        {
          id: "future",
          type: "TRAINING",
          title: "Allenamento",
          startAt: new Date(Date.UTC(2025, 9, 9, 18, 0)),
          attendanceStatus: "ABSENT", // must be ignored: future
        },
        {
          id: "match",
          type: "LEAGUE_MATCH",
          title: "vs Paladina",
          startAt: new Date(Date.UTC(2025, 9, 11, 15, 30)),
          opponentName: "Paladina",
          isConvoked: true,
          convocationResponse: "PENDING",
          meetingAt: new Date(Date.UTC(2025, 9, 11, 14, 15)),
        },
      ],
    });

    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.attendanceStatus, "PRESENT");
    assert.equal(rows[1]?.attendanceStatus, null);
    assert.equal(rows[1]?.isPast, false);
    assert.equal(rows[2]?.isMatch, true);
    assert.equal(rows[2]?.isConvoked, true);
  });

  it("excludes Match Day event to avoid duplication", () => {
    const wallNow = new Date(Date.UTC(2025, 9, 11, 12, 0, 0));
    const rows = buildAthleteWeekRows({
      wallNow,
      excludeEventId: "md",
      events: [
        {
          id: "md",
          type: "LEAGUE_MATCH",
          title: "vs Paladina",
          startAt: new Date(Date.UTC(2025, 9, 11, 15, 30)),
          opponentName: "Paladina",
        },
        {
          id: "tr",
          type: "TRAINING",
          title: "Allenamento",
          startAt: new Date(Date.UTC(2025, 9, 9, 18, 0)),
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "tr");
  });

  it("summarizes only past marked trainings (future not absences)", () => {
    const wallNow = new Date(Date.UTC(2025, 9, 8, 12, 0, 0));
    const rows = buildAthleteWeekRows({
      wallNow,
      events: [
        {
          id: "1",
          type: "TRAINING",
          title: "A",
          startAt: new Date(Date.UTC(2025, 9, 6, 18, 0)),
          attendanceStatus: "PRESENT",
        },
        {
          id: "2",
          type: "TRAINING",
          title: "B",
          startAt: new Date(Date.UTC(2025, 9, 7, 18, 0)),
          attendanceStatus: "ABSENT",
        },
        {
          id: "3",
          type: "TRAINING",
          title: "C",
          startAt: new Date(Date.UTC(2025, 9, 9, 18, 0)),
          attendanceStatus: "PRESENT",
        },
        {
          id: "4",
          type: "TRAINING",
          title: "D unmarked past",
          startAt: new Date(Date.UTC(2025, 9, 6, 10, 0)),
          attendanceStatus: null,
        },
      ],
    });
    const summary = summarizeWeekTrainings(rows);
    assert.equal(summary.completed, 1);
    assert.equal(summary.totalPastMarked, 2);
    assert.equal(summary.label, "1/2 allenamenti completati");
  });

  it("marks week completed only when all past sports events are PRESENT", () => {
    const wallNow = new Date(Date.UTC(2025, 9, 8, 12, 0, 0));
    const completed = buildAthleteWeekRows({
      wallNow,
      events: [
        {
          id: "t1",
          type: "TRAINING",
          title: "A",
          startAt: new Date(Date.UTC(2025, 9, 6, 18, 0)),
          attendanceStatus: "PRESENT",
        },
        {
          id: "m1",
          type: "LEAGUE_MATCH",
          title: "vs X",
          startAt: new Date(Date.UTC(2025, 9, 7, 15, 0)),
          attendanceStatus: "PRESENT",
        },
        {
          id: "future",
          type: "TRAINING",
          title: "C",
          startAt: new Date(Date.UTC(2025, 9, 9, 18, 0)),
          attendanceStatus: null,
        },
      ],
    });
    assert.equal(resolveAthleteWeekCompleted(completed), true);

    const missingAttendance = buildAthleteWeekRows({
      wallNow,
      events: [
        {
          id: "t1",
          type: "TRAINING",
          title: "A",
          startAt: new Date(Date.UTC(2025, 9, 6, 18, 0)),
          attendanceStatus: "PRESENT",
        },
        {
          id: "t2",
          type: "TRAINING",
          title: "B",
          startAt: new Date(Date.UTC(2025, 9, 7, 18, 0)),
          attendanceStatus: null,
        },
      ],
    });
    assert.equal(resolveAthleteWeekCompleted(missingAttendance), false);

    const withAbsent = buildAthleteWeekRows({
      wallNow,
      events: [
        {
          id: "t1",
          type: "TRAINING",
          title: "A",
          startAt: new Date(Date.UTC(2025, 9, 6, 18, 0)),
          attendanceStatus: "PRESENT",
        },
        {
          id: "t2",
          type: "TRAINING",
          title: "B",
          startAt: new Date(Date.UTC(2025, 9, 7, 18, 0)),
          attendanceStatus: "ABSENT",
        },
      ],
    });
    assert.equal(resolveAthleteWeekCompleted(withAbsent), false);

    const onlyFuture = buildAthleteWeekRows({
      wallNow,
      events: [
        {
          id: "t1",
          type: "TRAINING",
          title: "A",
          startAt: new Date(Date.UTC(2025, 9, 9, 18, 0)),
          attendanceStatus: "PRESENT",
        },
      ],
    });
    assert.equal(resolveAthleteWeekCompleted(onlyFuture), false);

    assert.equal(resolveAthleteWeekCompleted([]), false);
  });
});

describe("my-comun-nuovo season + chips", () => {
  it("computes training percent only from marked Attendance rows", () => {
    const stats = computeSeasonAthleteStats({
      attendances: [
        { status: "PRESENT", eventType: "TRAINING" },
        { status: "PRESENT", eventType: "TRAINING" },
        { status: "ABSENT", eventType: "TRAINING" },
        { status: "PRESENT", eventType: "LEAGUE_MATCH" },
      ],
      matchStats: [{ goals: 1, assists: 0 }],
    });
    assert.equal(stats.trainingPresent, 2);
    assert.equal(stats.trainingMarked, 3);
    assert.equal(stats.trainingPercent, 67);
    assert.equal(stats.matchPresences, 1);
    assert.equal(stats.goals, 1);
  });

  it("does not re-sum player goals into match result (season uses MatchPlayerStat only)", () => {
    // Season goals come from MatchPlayerStat, not Event.homeScore.
    const stats = computeSeasonAthleteStats({
      attendances: [{ status: "PRESENT", eventType: "LEAGUE_MATCH" }],
      matchStats: [{ goals: 1, assists: 1 }],
    });
    assert.equal(stats.goals, 1);
    assert.equal(stats.assists, 1);
  });

  it("builds last-5 chips without inventing presence", () => {
    const chips = buildRecentMatchChips([
      {
        id: "a",
        startAt: new Date(Date.UTC(2025, 9, 1)),
        opponentName: "Paladina",
        title: "vs Paladina",
        homeScore: 3,
        awayScore: 1,
        attendanceStatus: "PRESENT",
        goals: 1,
        assists: 0,
      },
      {
        id: "b",
        startAt: new Date(Date.UTC(2025, 8, 20)),
        opponentName: "Osio",
        title: "vs Osio",
        homeScore: 0,
        awayScore: 0,
        attendanceStatus: null,
        goals: 0,
        assists: 0,
      },
    ]);
    assert.equal(chips.length, 2);
    assert.equal(chips[0]?.present, true);
    assert.equal(chips[0]?.goals, 1);
    assert.equal(chips[1]?.present, false);
    assert.equal(chips[1]?.hasResult, true);
  });
});

describe("my-comun-nuovo achievements", () => {
  it("derives presence-first badges without rankings", () => {
    const stats = computeSeasonAthleteStats({
      attendances: [
        { status: "PRESENT", eventType: "LEAGUE_MATCH" },
        { status: "PRESENT", eventType: "TRAINING" },
        { status: "PRESENT", eventType: "TRAINING" },
        { status: "PRESENT", eventType: "TRAINING" },
        { status: "PRESENT", eventType: "TRAINING" },
        { status: "PRESENT", eventType: "TRAINING" },
      ],
      matchStats: [{ goals: 1, assists: 1 }],
    });
    const badges = computeMyComunAchievements({
      stats,
      position: "ATT",
      trainingStatusesChronological: [
        "PRESENT",
        "PRESENT",
        "PRESENT",
        "PRESENT",
        "PRESENT",
      ],
      cleanSheetCount: 0,
    });
    const ids = badges.map((b) => b.id);
    assert.ok(ids.includes("first-match"));
    assert.ok(ids.includes("first-goal"));
    assert.ok(ids.includes("first-assist"));
    assert.ok(ids.includes("trainings-5"));
    assert.ok(ids.includes("training-streak-5"));
    assert.equal(ids.includes("clean-sheet"), false);
    assert.equal(ids.some((id) => id.includes("rank") || id.includes("best")), false);
  });

  it("awards clean sheet only for POR with recorded 0 conceded", () => {
    const stats = computeSeasonAthleteStats({
      attendances: [{ status: "PRESENT", eventType: "LEAGUE_MATCH" }],
      matchStats: [{ goals: 0, assists: 0 }],
    });
    const asPor = computeMyComunAchievements({
      stats,
      position: "POR",
      cleanSheetCount: 1,
    });
    const asAtt = computeMyComunAchievements({
      stats,
      position: "ATT",
      cleanSheetCount: 1,
    });
    assert.ok(asPor.some((b) => b.id === "clean-sheet"));
    assert.equal(asAtt.some((b) => b.id === "clean-sheet"), false);
  });

  it("adds 25 trainings and growth path personal progress without rankings", () => {
    const attendances: Array<{ status: "PRESENT"; eventType: "TRAINING" | "LEAGUE_MATCH" }> = [
      ...Array.from({ length: 25 }, () => ({
        status: "PRESENT" as const,
        eventType: "TRAINING" as const,
      })),
      ...Array.from({ length: 10 }, () => ({
        status: "PRESENT" as const,
        eventType: "LEAGUE_MATCH" as const,
      })),
    ];
    const stats = computeSeasonAthleteStats({
      attendances,
      matchStats: [{ goals: 1, assists: 1 }],
    });
    const badges = computeMyComunAchievements({
      stats,
      position: "ATT",
      trainingStatusesChronological: Array.from({ length: 25 }, () => "PRESENT" as const),
    });
    const ids = badges.map((b) => b.id);
    assert.ok(ids.includes("trainings-25"));
    assert.ok(ids.includes("matches-10"));
    assert.ok(ids.includes("first-goal"));
    assert.ok(ids.includes("first-assist"));
    assert.equal(ids.some((id) => /rank|best|top|percent/i.test(id)), false);

    const path = buildAthleteGrowthPath({
      stats: {
        matchPresences: 8,
        goals: 0,
        assists: 0,
        trainingMarked: 8,
        trainingPresent: 8,
        trainingPercent: 100,
      },
      position: "ATT",
      nextLimit: 3,
    });
    assert.ok(path.reached.some((item) => item.id === "trainings-5"));
    const nextTrainings = path.next.find((item) => item.id === "trainings-10");
    assert.equal(nextTrainings?.progressLabel, "8/10");
    assert.equal(
      JSON.stringify(path).toLowerCase().includes("rank") ||
        JSON.stringify(path).toLowerCase().includes("classifica"),
      false,
    );
  });

  it("computes longest present streak interrupting on absence", () => {
    assert.equal(
      longestPresentStreak(["PRESENT", "PRESENT", "ABSENT", "PRESENT", "PRESENT", "PRESENT"]),
      3,
    );
    assert.equal(longestPresentStreak([]), 0);
  });

  it("handles athlete without role/shirt/photo via initials helper", () => {
    assert.equal(athleteInitials("Luca", "Rossi"), "LR");
    assert.equal(athleteInitials("", ""), "?");
  });

  it("hides coach note section when no note (empty badges ok)", () => {
    const badges = computeMyComunAchievements({
      stats: {
        matchPresences: 0,
        goals: 0,
        assists: 0,
        trainingMarked: 0,
        trainingPresent: 0,
        trainingPercent: null,
      },
      position: null,
    });
    assert.equal(badges.length, 0);
  });
});
