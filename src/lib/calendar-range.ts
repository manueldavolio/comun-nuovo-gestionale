import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";

/** Primo giorno del mese wall-clock Europe/Rome (UTC fields). */
export function currentCalendarMonthStart(now = new Date()): Date {
  const wall = nowAsEuropeRomeWallClockUtc(now);
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function calendarMonthBounds(year: number, monthIndex0: number): {
  start: Date;
  end: Date;
} {
  return {
    start: new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59, 999)),
  };
}

/**
 * Range query per la griglia mensile (lun–dom) + piccolo padding:
 * dal lunedì della settimana del 1° al domenica della settimana dell'ultimo giorno.
 */
export function calendarVisibleRangeForMonth(year: number, monthIndex0: number): {
  start: Date;
  end: Date;
} {
  const { start: monthStart, end: monthEnd } = calendarMonthBounds(year, monthIndex0);
  const startDow = monthStart.getUTCDay(); // 0=dom
  const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
  const start = new Date(
    Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth(),
      monthStart.getUTCDate() + mondayOffset,
      0,
      0,
      0,
      0,
    ),
  );

  const endDow = monthEnd.getUTCDay();
  const sundayOffset = endDow === 0 ? 0 : 7 - endDow;
  const end = new Date(
    Date.UTC(
      monthEnd.getUTCFullYear(),
      monthEnd.getUTCMonth(),
      monthEnd.getUTCDate() + sundayOffset,
      23,
      59,
      59,
      999,
    ),
  );

  return { start, end };
}

export function parseYearMonthParam(value: string | null | undefined): {
  year: number;
  monthIndex0: number;
} | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return { year, monthIndex0: month - 1 };
}

export function formatYearMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
