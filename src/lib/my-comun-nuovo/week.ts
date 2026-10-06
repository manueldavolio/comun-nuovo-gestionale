import type { AttendanceStatus, EventType } from "@prisma/client";
import { EVENT_TYPE_LABEL } from "@/lib/events";
import { isMatchEventType } from "@/lib/parent-season";
import { wallClockWeekBounds } from "@/lib/mister-week";
import { resolveMatchDayOpponentName } from "@/lib/match-day";

export type WeekEventInput = {
  id: string;
  type: EventType | string;
  title: string;
  startAt: Date;
  opponentName?: string | null;
  isHome?: boolean | null;
  attendanceStatus?: AttendanceStatus | null;
  convocationResponse?: string | null;
  isConvoked?: boolean;
  meetingAt?: Date | null;
};

export type WeekEventRow = {
  id: string;
  type: string;
  typeLabel: string;
  startAt: Date;
  title: string;
  isMatch: boolean;
  opponentLabel: string | null;
  /** Passato rispetto a wallNow (startAt < wallNow). */
  isPast: boolean;
  attendanceStatus: AttendanceStatus | null;
  isConvoked: boolean;
  convocationResponse: string | null;
  meetingAt: Date | null;
};

export type WeekTrainingSummary = {
  completed: number;
  totalPastMarked: number;
  label: string | null;
};

const WEEKDAY_SHORT = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"] as const;
const MONTH_SHORT = [
  "GEN",
  "FEB",
  "MAR",
  "APR",
  "MAG",
  "GIU",
  "LUG",
  "AGO",
  "SET",
  "OTT",
  "NOV",
  "DIC",
] as const;

export function myComunWeekBounds(wallNow: Date): { start: Date; end: Date } {
  return wallClockWeekBounds(wallNow);
}

export function formatWeekEventDateLabel(startAt: Date): string {
  const wd = WEEKDAY_SHORT[startAt.getUTCDay()] ?? "—";
  const day = startAt.getUTCDate();
  const month = MONTH_SHORT[startAt.getUTCMonth()] ?? "";
  return `${wd} ${day} ${month}`;
}

/**
 * Costruisce le righe settimana in ordine cronologico.
 * Eventi futuri: nessun stato presenza inventato.
 * Eventi passati: solo se Attendance esiste.
 */
export function buildAthleteWeekRows(input: {
  events: WeekEventInput[];
  wallNow: Date;
  /** Es. Match Day odierno già in hero: evita doppione. */
  excludeEventId?: string | null;
}): WeekEventRow[] {
  const rows = input.events
    .filter((event) => event.id !== input.excludeEventId)
    .slice()
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map((event) => {
      const isMatch = isMatchEventType(event.type);
      const isPast = event.startAt.getTime() < input.wallNow.getTime();
      return {
        id: event.id,
        type: String(event.type),
        typeLabel: EVENT_TYPE_LABEL[event.type as EventType] ?? "Evento",
        startAt: event.startAt,
        title: event.title,
        isMatch,
        opponentLabel: isMatch
          ? resolveMatchDayOpponentName({
              opponentName: event.opponentName,
              title: event.title,
            })
          : null,
        isPast,
        attendanceStatus: isPast ? (event.attendanceStatus ?? null) : null,
        isConvoked: Boolean(event.isConvoked),
        convocationResponse: event.convocationResponse ?? null,
        meetingAt: event.meetingAt ?? null,
      };
    });

  return rows;
}

/**
 * Riepilogo allenamenti settimana: solo TRAINING passati CON Attendance registrata.
 * Futuri e non marcati non entrano nel denominatore.
 */
export function summarizeWeekTrainings(rows: WeekEventRow[]): WeekTrainingSummary {
  const pastTrainings = rows.filter(
    (row) => row.type === "TRAINING" && row.isPast && row.attendanceStatus != null,
  );
  const completed = pastTrainings.filter((row) => row.attendanceStatus === "PRESENT").length;
  const totalPastMarked = pastTrainings.length;
  if (totalPastMarked === 0) {
    return { completed: 0, totalPastMarked: 0, label: null };
  }
  return {
    completed,
    totalPastMarked,
    label: `${completed}/${totalPastMarked} allenamenti completati`,
  };
}

const SPORTS_EVENT_TYPES = new Set([
  "TRAINING",
  "LEAGUE_MATCH",
  "FRIENDLY",
  "TOURNAMENT",
]);

/**
 * Settimana completata: solo con dati completi e tutti PRESENT.
 * Attendance mancante ≠ assenza: in quel caso weekCompleted = false senza penalizzazione.
 * Eventi futuri ignorati. Nessun evento passato → false.
 */
export function resolveAthleteWeekCompleted(rows: WeekEventRow[]): boolean {
  const pastSports = rows.filter(
    (row) => row.isPast && SPORTS_EVENT_TYPES.has(row.type),
  );
  if (pastSports.length === 0) {
    return false;
  }
  return pastSports.every((row) => row.attendanceStatus === "PRESENT");
}
