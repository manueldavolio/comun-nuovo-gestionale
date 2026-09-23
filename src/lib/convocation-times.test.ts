import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultMeetingAtFromMatchStart,
  formatConvocationWallClockDate,
  formatConvocationWallClockDateTime,
  formatConvocationWallClockTime,
  resolveMeetingAt,
} from "./convocation-times";
import { buildConvocationEmailText } from "./mail";

const MATCH = new Date(Date.UTC(2026, 8, 20, 15, 30, 0));
const MEETING = new Date(Date.UTC(2026, 8, 20, 14, 30, 0));

describe("convocation times", () => {
  it("formats wall-clock date and time from UTC storage", () => {
    assert.equal(formatConvocationWallClockDate(MATCH), "20/09/2026");
    assert.equal(formatConvocationWallClockTime(MATCH), "15:30");
    assert.equal(formatConvocationWallClockDateTime(MEETING), "20/09/2026 ore 14:30");
  });

  it("resolves meetingAt with fallback to match start", () => {
    assert.equal(resolveMeetingAt(MEETING, MATCH).getTime(), MEETING.getTime());
    assert.equal(resolveMeetingAt(null, MATCH).getTime(), MATCH.getTime());
  });

  it("defaults meeting time to one hour before kickoff", () => {
    assert.equal(defaultMeetingAtFromMatchStart(MATCH).getTime(), MEETING.getTime());
  });

  it("builds email text with distinct convocazione and partita times", () => {
    const text = buildConvocationEmailText({
      athleteFullName: "Mario Rossi",
      eventTitle: "Partita vs Rivali",
      categoryName: "Esordienti",
      startAt: MATCH,
      meetingAt: MEETING,
      location: "Centro Sportivo",
    });

    assert.match(text, /Data: 20\/09\/2026/);
    assert.match(text, /Convocazione: ore 14:30/);
    assert.match(text, /Partita: ore 15:30/);
    assert.match(text, /Luogo: Centro Sportivo/);
  });
});
