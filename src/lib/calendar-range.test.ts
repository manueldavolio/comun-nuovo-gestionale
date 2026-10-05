import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calendarMonthBounds,
  calendarVisibleRangeForMonth,
  currentCalendarMonthStart,
  formatYearMonth,
  parseYearMonthParam,
} from "./calendar-range";

describe("calendar-range Europe/Rome", () => {
  it("opens on current Europe/Rome month, not first event month", () => {
    // 5 Oct 2026 10:00 CEST = 08:00 UTC → wall-clock Oct
    const now = new Date("2026-10-05T08:00:00.000Z");
    const monthStart = currentCalendarMonthStart(now);
    assert.equal(formatYearMonth(monthStart), "2026-10");
    assert.equal(monthStart.toISOString(), "2026-10-01T00:00:00.000Z");
  });

  it("builds month bounds beyond April 2027 without artificial cap", () => {
    const may2027 = calendarMonthBounds(2027, 4); // May
    assert.equal(may2027.start.toISOString(), "2027-05-01T00:00:00.000Z");
    assert.equal(may2027.end.toISOString(), "2027-05-31T23:59:59.999Z");

    const jul2027 = calendarVisibleRangeForMonth(2027, 6); // July season end
    assert.ok(jul2027.start.getTime() < jul2027.end.getTime());
    // Il padding settimanale può spingere la fine in agosto: il mese richiesto resta luglio.
    const monthOnly = calendarMonthBounds(2027, 6);
    assert.equal(monthOnly.end.getUTCMonth(), 6);
    assert.ok(jul2027.end.getTime() >= monthOnly.end.getTime());
  });

  it("parses month query params for lazy loading", () => {
    assert.deepEqual(parseYearMonthParam("2027-05"), { year: 2027, monthIndex0: 4 });
    assert.equal(parseYearMonthParam("2027-13"), null);
    assert.equal(parseYearMonthParam("bad"), null);
  });

  it("pads visible range to Monday–Sunday grid", () => {
    // October 2026: 1st is Thursday → grid starts Mon 28 Sep
    const range = calendarVisibleRangeForMonth(2026, 9);
    assert.equal(range.start.getUTCDay(), 1);
    assert.equal(range.end.getUTCDay(), 0);
    assert.ok(range.start.getTime() < new Date(Date.UTC(2026, 9, 1)).getTime());
    assert.ok(range.end.getTime() > new Date(Date.UTC(2026, 9, 31)).getTime());
  });
});
