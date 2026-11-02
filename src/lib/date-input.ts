/**
 * Convention: Italian (Europe/Rome) wall-clock values are stored in Date UTC fields
 * (15:00 Italian → 15:00:00.000Z). Never use host-local `new Date("…T15:00")` /
 * `setHours` / `getDay` for event times — they depend on the runtime TZ (e.g. dub1).
 */

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

/**
 * Parse datetime-local / floating ISO without timezone (`YYYY-MM-DDTHH:mm[:ss]`)
 * as wall-clock into UTC fields. Independent of process TZ.
 */
export function parseWallClockDateTimeInput(value: string): Date | null {
  const trimmed = value.trim();
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  const isValid =
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second;

  return isValid ? parsed : null;
}

/** Combine `YYYY-MM-DD` + `HH:mm` into wall-clock UTC fields. */
export function combineWallClockDateAndTime(
  dateYmd: string,
  timeHm: string,
): Date | null {
  const time = timeHm.trim();
  const normalized = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  return parseWallClockDateTimeInput(`${dateYmd.trim()}T${normalized}`);
}

export function startOfWallClockDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
}

export function endOfWallClockDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

/** Sunday=0 … Saturday=6 from wall-clock UTC fields (not host TZ). */
export function wallClockWeekdayUTC(date: Date): number {
  return date.getUTCDay();
}

export function addWallClockDaysUTC(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

/** Display wall-clock event/match datetime for Italian UI/email (UTC fields). */
export function formatWallClockDateTimeIt(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

/** Display wall-clock date-only (UTC fields) as dd/mm/yyyy. */
export function formatWallClockDateIt(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a real instant (e.g. Stripe paidAt) as a calendar date in Europe/Rome.
 * Do not use for wall-clock Event.startAt values.
 */
export function formatEuropeRomeInstantDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

/** Sports season label `YYYY/YYYY+1` from a real instant via Europe/Rome (Aug–Jul). */
export function sportsSeasonLabelFromInstant(now = new Date()): string {
  const wall = nowAsEuropeRomeWallClockUtc(now);
  const year = wall.getUTCFullYear();
  const month = wall.getUTCMonth();
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}


