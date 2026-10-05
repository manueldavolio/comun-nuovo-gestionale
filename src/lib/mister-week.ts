import { isMatchEventType } from "@/lib/parent-season";
import { isSameWallClockDay } from "@/lib/match-day";

export type MisterWeekEvent = {
  id: string;
  type: string;
  title: string;
  startAt: Date;
  opponentName?: string | null;
  isHome?: boolean | null;
};

export type MisterWeekDay = {
  date: Date;
  weekdayShort: string;
  isToday: boolean;
  events: MisterWeekEvent[];
};

const WEEKDAY_SHORT = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"] as const;

/** Lunedì 00:00 → Domenica 23:59:59.999 della settimana wall-clock di `wallNow`. */
export function wallClockWeekBounds(wallNow: Date): { start: Date; end: Date } {
  const year = wallNow.getUTCFullYear();
  const month = wallNow.getUTCMonth();
  const day = wallNow.getUTCDate();
  const dow = wallNow.getUTCDay(); // 0 = Sunday
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(Date.UTC(year, month, day + mondayOffset, 0, 0, 0, 0));
  const sunday = new Date(Date.UTC(year, month, day + mondayOffset + 6, 23, 59, 59, 999));
  return { start: monday, end: sunday };
}

export function buildMisterWeekTimeline(
  events: MisterWeekEvent[],
  wallNow: Date,
): MisterWeekDay[] {
  const { start } = wallClockWeekBounds(wallNow);
  const days: MisterWeekDay[] = [];

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate() + i,
        12,
        0,
        0,
        0,
      ),
    );
    const dayEvents = events
      .filter((event) => isSameWallClockDay(event.startAt, date))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    days.push({
      date,
      weekdayShort: WEEKDAY_SHORT[date.getUTCDay()] ?? "—",
      isToday: isSameWallClockDay(date, wallNow),
      events: dayEvents,
    });
  }

  // Compact: drop empty days that are not today (keep today always for orientation).
  return days.filter((day) => day.isToday || day.events.length > 0);
}

export function isMatchWeekEvent(type: string): boolean {
  return isMatchEventType(type);
}
