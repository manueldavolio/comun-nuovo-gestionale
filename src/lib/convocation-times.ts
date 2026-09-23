/**
 * Convocation / match times follow the same UTC wall-clock convention as Event.startAt
 * (Europe/Rome "local" values stored without timezone conversion).
 */

export function formatConvocationWallClockDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function formatConvocationWallClockTime(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatConvocationWallClockDateTime(date: Date): string {
  return `${formatConvocationWallClockDate(date)} ore ${formatConvocationWallClockTime(date)}`;
}

/** Prefer explicit meetingAt; fall back to match start for legacy rows. */
export function resolveMeetingAt(meetingAt: Date | null | undefined, matchStartAt: Date): Date {
  return meetingAt ?? matchStartAt;
}

/** Default form value: 1 hour before kickoff (wall-clock), floored to the minute. */
export function defaultMeetingAtFromMatchStart(matchStartAt: Date): Date {
  const meeting = new Date(matchStartAt.getTime());
  meeting.setUTCMinutes(meeting.getUTCMinutes() - 60);
  return meeting;
}
