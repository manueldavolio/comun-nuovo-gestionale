export function parseDateInputToUTC(dateInput: string): Date | null {
  const value = dateInput.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // JS Date months are 0-based.
  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const isValid =
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return isValid ? parsed : null;
}

export function toDateInputValueUTC(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Serializes a DB datetime as a timezone-naive ISO string (no `Z`).
 * Event times are stored as UTC wall-clock values; passing `.toISOString()`
 * makes the client shift them by the local offset (e.g. 15:00 → 17:00 in CEST).
 */
export function toFloatingDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/** Value for `<input type="datetime-local">` from a UTC wall-clock Date. */
export function toDateTimeLocalValueUTC(date: Date): string {
  return toFloatingDateTime(date).slice(0, 16);
}

/**
 * Current instant as Europe/Rome wall-clock encoded in UTC fields.
 * Matches Event.startAt storage convention (local Rome time stored as UTC).
 */
export function nowAsEuropeRomeWallClockUtc(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));
  const second = Number(get("second"));

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
}


