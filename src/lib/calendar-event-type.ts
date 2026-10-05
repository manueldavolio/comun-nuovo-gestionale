import type { CalendarEvent } from "@/components/calendar/month-calendar";

export function normalizeCalendarEventType(
  type: string | null | undefined,
): CalendarEvent["type"] {
  const normalized = type?.trim().toUpperCase();

  switch (normalized) {
    case "ALLENAMENTO":
    case "TRAINING":
      return "ALLENAMENTO";
    case "PARTITA":
    case "LEAGUE_MATCH":
    case "MATCH":
      return "PARTITA";
    case "AMICHEVOLE":
    case "FRIENDLY":
      return "AMICHEVOLE";
    case "TORNEO":
    case "TOURNAMENT":
      return "TORNEO";
    case "RIUNIONE":
    case "MEETING":
      return "RIUNIONE";
    case "CONVOCAZIONE":
    case "CONVOCATION":
      return "CONVOCAZIONE";
    default:
      return "ALLENAMENTO";
  }
}
