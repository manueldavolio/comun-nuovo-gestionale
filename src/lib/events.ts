import type { EventType } from "@/generated/prisma/enums";

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  TRAINING: "Allenamento",
  LEAGUE_MATCH: "Partita",
  FRIENDLY: "Amichevole",
  TOURNAMENT: "Torneo",
  OTHER: "Altro",
};

export const EVENT_TYPE_CHOICES: { value: EventType; label: string }[] = [
  { value: "TRAINING", label: "Allenamento" },
  { value: "LEAGUE_MATCH", label: "Partita" },
  { value: "TOURNAMENT", label: "Torneo" },
];

export const COACH_VISIBLE_EVENT_TYPES: EventType[] = [
  "TRAINING",
  "LEAGUE_MATCH",
  "FRIENDLY",
  "TOURNAMENT",
];

export function formatEventType(type: EventType) {
  return EVENT_TYPE_LABEL[type] ?? "Evento";
}
