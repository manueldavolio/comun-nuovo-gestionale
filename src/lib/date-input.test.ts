import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import {
  addWallClockDaysUTC,
  combineWallClockDateAndTime,
  formatEuropeRomeInstantDate,
  formatWallClockDateTimeIt,
  nowAsEuropeRomeWallClockUtc,
  parseWallClockDateTimeInput,
  sportsSeasonLabelFromInstant,
  startOfWallClockDayUTC,
  endOfWallClockDayUTC,
  wallClockWeekdayUTC,
} from "./date-input";

describe("wall-clock parse independent of host TZ", () => {
  it("parses 15:00 Italian wall as 15:00Z (CET and CEST samples)", () => {
    const winter = parseWallClockDateTimeInput("2026-01-15T15:00");
    const summer = parseWallClockDateTimeInput("2026-07-15T15:00");
    assert.ok(winter);
    assert.ok(summer);
    assert.equal(winter.toISOString(), "2026-01-15T15:00:00.000Z");
    assert.equal(summer.toISOString(), "2026-07-15T15:00:00.000Z");
  });

  it("host-local Date parsing shifts by TZ; wall helper does not", () => {
    const wallIso = parseWallClockDateTimeInput("2026-01-15T15:00")!.toISOString();
    assert.equal(wallIso, "2026-01-15T15:00:00.000Z");

    const hostIsos = ["UTC", "Europe/Rome", "Europe/Dublin", "America/New_York"].map(
      (tz) => {
        const result = spawnSync(
          process.execPath,
          ["-e", 'process.stdout.write(new Date("2026-01-15T15:00").toISOString())'],
          { env: { ...process.env, TZ: tz }, encoding: "utf8" },
        );
        assert.equal(result.status, 0, `${tz}: ${result.stderr}`);
        return { tz, iso: result.stdout };
      },
    );

    assert.equal(
      hostIsos.find((row) => row.tz === "UTC")?.iso,
      "2026-01-15T15:00:00.000Z",
    );
    assert.equal(
      hostIsos.find((row) => row.tz === "Europe/Rome")?.iso,
      "2026-01-15T14:00:00.000Z",
    );
    assert.notEqual(
      hostIsos.find((row) => row.tz === "America/New_York")?.iso,
      wallIso,
    );
  });

  it("rejects invalid calendar dates", () => {
    assert.equal(parseWallClockDateTimeInput("2026-02-30T12:00"), null);
    assert.equal(parseWallClockDateTimeInput("2026-13-01T12:00"), null);
    assert.equal(parseWallClockDateTimeInput("not-a-date"), null);
  });

  it("combines date + time for bulk trainings", () => {
    const startAt = combineWallClockDateAndTime("2026-03-29", "18:30");
    assert.ok(startAt);
    assert.equal(startAt.toISOString(), "2026-03-29T18:30:00.000Z");
  });
});

describe("DST transitions March / October (Europe/Rome)", () => {
  it("keeps wall clock across spring-forward Sunday 2026-03-29", () => {
    // EU: clocks jump 02:00 → 03:00; wall storage still records the typed hour.
    const before = parseWallClockDateTimeInput("2026-03-28T15:00");
    const after = parseWallClockDateTimeInput("2026-03-30T15:00");
    assert.equal(before?.toISOString(), "2026-03-28T15:00:00.000Z");
    assert.equal(after?.toISOString(), "2026-03-30T15:00:00.000Z");
  });

  it("keeps wall clock across fall-back Sunday 2026-10-25", () => {
    const before = parseWallClockDateTimeInput("2026-10-24T15:00");
    const after = parseWallClockDateTimeInput("2026-10-26T15:00");
    assert.equal(before?.toISOString(), "2026-10-24T15:00:00.000Z");
    assert.equal(after?.toISOString(), "2026-10-26T15:00:00.000Z");
  });

  it("formats wall clock without host shift in CET and CEST", () => {
    assert.equal(
      formatWallClockDateTimeIt(new Date(Date.UTC(2026, 0, 15, 15, 0))),
      "15/01/2026, 15:00",
    );
    assert.equal(
      formatWallClockDateTimeIt(new Date(Date.UTC(2026, 6, 15, 15, 0))),
      "15/07/2026, 15:00",
    );
  });

  it("nowAsEuropeRomeWallClockUtc follows Rome across DST for a fixed instant", () => {
    // EU spring 2026-03-29: 02:00 CET → 03:00 CEST (= 01:00 UTC).
    // 00:30 UTC = 01:30 CET (before jump)
    const beforeJump = nowAsEuropeRomeWallClockUtc(
      new Date("2026-03-29T00:30:00.000Z"),
    );
    assert.equal(beforeJump.toISOString(), "2026-03-29T01:30:00.000Z");

    // 01:00 UTC = 03:00 CEST (after jump)
    const afterJump = nowAsEuropeRomeWallClockUtc(
      new Date("2026-03-29T01:00:00.000Z"),
    );
    assert.equal(afterJump.toISOString(), "2026-03-29T03:00:00.000Z");

    // Fall back 2026-10-25: 03:00 CEST → 02:00 CET (= 01:00 UTC).
    const afterFall = nowAsEuropeRomeWallClockUtc(
      new Date("2026-10-25T01:30:00.000Z"),
    );
    assert.equal(afterFall.toISOString(), "2026-10-25T02:30:00.000Z");
  });
});

describe("bulk day iteration uses UTC weekday", () => {
  it("walks Mon–Sun in wall calendar across DST week", () => {
    let cursor = startOfWallClockDayUTC(
      parseWallClockDateTimeInput("2026-03-23T00:00")!,
    );
    const end = endOfWallClockDayUTC(
      parseWallClockDateTimeInput("2026-03-29T00:00")!,
    );
    const weekdays: number[] = [];
    const times: string[] = [];
    while (cursor.getTime() <= end.getTime()) {
      weekdays.push(wallClockWeekdayUTC(cursor));
      const training = combineWallClockDateAndTime(
        `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`,
        "17:00",
      );
      times.push(training!.toISOString());
      cursor = addWallClockDaysUTC(cursor, 1);
    }
    // 23 Mon … 29 Sun
    assert.deepEqual(weekdays, [1, 2, 3, 4, 5, 6, 0]);
    assert.equal(times[0], "2026-03-23T17:00:00.000Z");
    assert.equal(times[6], "2026-03-29T17:00:00.000Z");
  });
});

describe("season label Europe/Rome", () => {
  it("uses August boundary in Rome, not UTC midnight edge", () => {
    // 31 Jul 2026 22:30 UTC = 1 Aug 00:30 Rome (CEST) → new season 2026/2027
    const label = sportsSeasonLabelFromInstant(
      new Date("2026-07-31T22:30:00.000Z"),
    );
    assert.equal(label, "2026/2027");

    // 31 Jul 2026 20:00 UTC = 31 Jul 22:00 Rome → still 2025/2026
    const prev = sportsSeasonLabelFromInstant(
      new Date("2026-07-31T20:00:00.000Z"),
    );
    assert.equal(prev, "2025/2026");
  });
});

describe("receipt instant date (Europe/Rome)", () => {
  it("formats paidAt evening on Rome calendar day", () => {
    // 1 Nov 2026 23:30 UTC = 2 Nov 00:30 Rome
    const label = formatEuropeRomeInstantDate(
      new Date("2026-11-01T23:30:00.000Z"),
    );
    assert.match(label, /02/);
    assert.match(label, /11/);
    assert.match(label, /2026/);
  });
});
