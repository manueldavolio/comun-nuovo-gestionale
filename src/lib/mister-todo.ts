import { isMatchEventType } from "@/lib/parent-season";
import { resolveMatchVisualEndAt } from "@/lib/match-day";
import {
  INCOMPLETE_MATCH_LOOKBACK_DAYS,
  resolveIncompleteReasons,
  softStatsHintForCompleteMatch,
  type IncompleteMatchCandidate,
} from "@/lib/mister-incomplete";
import { ACTIVE_PERSONAL_GOAL_STATUSES } from "@/lib/athlete-personal-goals";
import type { PeriodScoreInput } from "@/lib/four-period-scoring";

export const MISTER_TODO_CONVOCATION_WINDOW_DAYS = 7;
export const MISTER_TODO_TRAINING_LOOKBACK_DAYS = 14;
export const MISTER_TODO_MAX_ITEMS = 12;

export type MisterTodoKind =
  | "MISSING_ATTENDANCE"
  | "MISSING_RESULT"
  | "SOFT_STATS"
  | "PREPARE_CONVOCATION"
  | "PENDING_RSVP"
  | "MISSING_COACH_NOTES"
  | "SUGGEST_GOALS";

export type MisterTodoPriority = "high" | "medium" | "soft" | "suggestion";

export type MisterTodoItem = {
  id: string;
  kind: MisterTodoKind;
  priority: MisterTodoPriority;
  title: string;
  subtitle: string | null;
  href: string;
  eventId?: string;
  count?: number;
};

export type MisterTodoPastEvent = IncompleteMatchCandidate & {
  /** TRAINING | match types */
  type: string;
};

export type MisterTodoFutureMatch = {
  id: string;
  title: string;
  type: string;
  startAt: Date;
  opponentName: string | null;
  categoryName?: string | null;
  hasConvocation: boolean;
  pendingRsvpCount: number;
};

export type MisterTodoAthleteGrowth = {
  athleteId: string;
  hasCurrentMonthNote: boolean;
  activeGoalCount: number;
};

function isPastEvent(input: {
  startAt: Date;
  endAt: Date | null;
  wallNow: Date;
}): boolean {
  const effectiveEnd = resolveMatchVisualEndAt(input.startAt, input.endAt);
  return input.wallNow.getTime() > effectiveEnd.getTime();
}

function opponentOrTitle(opponentName: string | null, title: string): string {
  const opponent = (opponentName ?? "").trim();
  if (opponent) return opponent;
  return title.trim() || "Partita";
}

/**
 * Deriva la lista "Da fare" da dati già caricati in batch.
 * Solo task affidabili; soft/suggestion separati.
 */
export function buildMisterTodos(input: {
  wallNow: Date;
  pastEvents: MisterTodoPastEvent[];
  futureMatches: MisterTodoFutureMatch[];
  athletes: MisterTodoAthleteGrowth[];
  allowedCategoryIds: string[];
  lookbackDays?: number;
  convocationWindowDays?: number;
  maxItems?: number;
}): MisterTodoItem[] {
  const lookbackDays = input.lookbackDays ?? INCOMPLETE_MATCH_LOOKBACK_DAYS;
  const convocationWindowDays =
    input.convocationWindowDays ?? MISTER_TODO_CONVOCATION_WINDOW_DAYS;
  const maxItems = input.maxItems ?? MISTER_TODO_MAX_ITEMS;
  const allowed = new Set(input.allowedCategoryIds);
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
  const trainingLookbackMs = MISTER_TODO_TRAINING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const earliestMatch = input.wallNow.getTime() - lookbackMs;
  const earliestTraining = input.wallNow.getTime() - trainingLookbackMs;
  const convocationHorizon =
    input.wallNow.getTime() + convocationWindowDays * 24 * 60 * 60 * 1000;

  const high: MisterTodoItem[] = [];
  const medium: MisterTodoItem[] = [];
  const soft: MisterTodoItem[] = [];
  const suggestions: MisterTodoItem[] = [];

  for (const event of input.pastEvents) {
    if (!event.categoryId || !allowed.has(event.categoryId)) continue;
    if (
      !isPastEvent({
        startAt: event.startAt,
        endAt: event.endAt,
        wallNow: input.wallNow,
      })
    ) {
      continue;
    }

    const isMatch = isMatchEventType(event.type);
    const isTraining = event.type === "TRAINING";
    if (!isMatch && !isTraining) continue;

    if (isTraining) {
      if (event.startAt.getTime() < earliestTraining) continue;
      if (event.attendanceCount <= 0) {
        high.push({
          id: `attendance-${event.id}`,
          kind: "MISSING_ATTENDANCE",
          priority: "high",
          title: "Presenze da registrare",
          subtitle: event.title,
          href: `/mister/eventi/${event.id}/presenze`,
          eventId: event.id,
        });
      }
      continue;
    }

    if (event.startAt.getTime() < earliestMatch) continue;

    const reasons = resolveIncompleteReasons(event);
    for (const reason of reasons) {
      if (reason === "MISSING_ATTENDANCE") {
        high.push({
          id: `attendance-${event.id}`,
          kind: "MISSING_ATTENDANCE",
          priority: "high",
          title: "Presenze da registrare",
          subtitle: `vs ${opponentOrTitle(event.opponentName, event.title)}`,
          href: `/mister/eventi/${event.id}/presenze`,
          eventId: event.id,
        });
      }
      if (reason === "MISSING_RESULT") {
        high.push({
          id: `result-${event.id}`,
          kind: "MISSING_RESULT",
          priority: "high",
          title: "Risultato da inserire",
          subtitle: `vs ${opponentOrTitle(event.opponentName, event.title)}`,
          href: `/mister/eventi/${event.id}/presenze`,
          eventId: event.id,
        });
      }
    }

    if (reasons.length === 0) {
      if (softStatsHintForCompleteMatch(event)) {
        soft.push({
          id: `stats-${event.id}`,
          kind: "SOFT_STATS",
          priority: "soft",
          title: "Verifica gol/assist",
          subtitle: `vs ${opponentOrTitle(event.opponentName, event.title)}`,
          href: `/mister/eventi/${event.id}/presenze`,
          eventId: event.id,
        });
      }
    } else if (
      !reasons.includes("MISSING_RESULT") &&
      softStatsHintForCompleteMatch(event)
    ) {
      soft.push({
        id: `stats-${event.id}`,
        kind: "SOFT_STATS",
        priority: "soft",
        title: "Verifica gol/assist",
        subtitle: `vs ${opponentOrTitle(event.opponentName, event.title)}`,
        href: `/mister/eventi/${event.id}/presenze`,
        eventId: event.id,
      });
    }
  }

  for (const match of input.futureMatches) {
    if (!isMatchEventType(match.type)) continue;
    if (match.startAt.getTime() < input.wallNow.getTime()) continue;
    if (match.startAt.getTime() > convocationHorizon) continue;

    if (!match.hasConvocation) {
      medium.push({
        id: `convocation-${match.id}`,
        kind: "PREPARE_CONVOCATION",
        priority: "medium",
        title: "Prepara convocazione",
        subtitle: `vs ${opponentOrTitle(match.opponentName, match.title)}`,
        href: `/mister/eventi/${match.id}/convocazioni`,
        eventId: match.id,
      });
      continue;
    }

    if (match.pendingRsvpCount > 0) {
      medium.push({
        id: `rsvp-${match.id}`,
        kind: "PENDING_RSVP",
        priority: "medium",
        title:
          match.pendingRsvpCount === 1
            ? "1 risposta mancante"
            : `${match.pendingRsvpCount} risposte mancanti`,
        subtitle: `vs ${opponentOrTitle(match.opponentName, match.title)}`,
        href: `/mister/eventi/${match.id}/convocazioni`,
        eventId: match.id,
        count: match.pendingRsvpCount,
      });
    }
  }

  if (input.athletes.length > 0) {
    const missingNotes = input.athletes.filter((athlete) => !athlete.hasCurrentMonthNote).length;
    if (missingNotes > 0) {
      soft.push({
        id: "coach-notes-month",
        kind: "MISSING_COACH_NOTES",
        priority: "soft",
        title:
          missingNotes === 1
            ? "1 messaggio del mister da completare"
            : `${missingNotes} messaggi del mister da completare`,
        subtitle: "Mese corrente · Squadra",
        href: "/mister/squadra",
        count: missingNotes,
      });
    }

    const withoutGoals = input.athletes.filter((athlete) => athlete.activeGoalCount === 0).length;
    if (withoutGoals > 0) {
      suggestions.push({
        id: "suggest-goals",
        kind: "SUGGEST_GOALS",
        priority: "suggestion",
        title:
          withoutGoals === 1
            ? "1 ragazzo senza obiettivi attivi"
            : `${withoutGoals} ragazzi senza obiettivi attivi`,
        subtitle: "Suggerimento · non obbligatorio",
        href: "/mister/squadra",
        count: withoutGoals,
      });
    }
  }

  const ordered = [...high, ...medium, ...soft, ...suggestions];
  return ordered.slice(0, maxItems);
}

export function misterTodoPriorityLabel(priority: MisterTodoPriority): string {
  switch (priority) {
    case "high":
      return "Da fare";
    case "medium":
      return "Da preparare";
    case "soft":
      return "Da verificare";
    case "suggestion":
      return "Suggerimento";
    default:
      return "";
  }
}

export { ACTIVE_PERSONAL_GOAL_STATUSES };
export type { PeriodScoreInput };
