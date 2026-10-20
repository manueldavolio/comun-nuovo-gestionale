import { MATCH_EVENT_TYPES, isMatchEventType } from "@/lib/parent-season";

export type MatchListFilter = "all" | "upcoming" | "played";

export type MatchLifecycleStatus =
  | "UPCOMING"
  | "PLAYED"
  | "NO_RESULT"
  | "POSTPONED"
  | "CANCELLED";

export const MATCH_LIFECYCLE_LABEL: Record<MatchLifecycleStatus, string> = {
  UPCOMING: "Da giocare",
  PLAYED: "Giocata",
  NO_RESULT: "Senza risultato",
  POSTPONED: "Rinviata",
  CANCELLED: "Annullata",
};

export const MATCH_LIST_FILTER_LABEL: Record<MatchListFilter, string> = {
  all: "Tutte",
  upcoming: "Da giocare",
  played: "Giocate",
};

export { MATCH_EVENT_TYPES, isMatchEventType };

/** Hint soft da titolo/descrizione (nessun flag DB). */
export function inferMatchScheduleHint(
  title: string,
  description?: string | null,
): "POSTPONED" | "CANCELLED" | null {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  if (/annullat|cancellat|sospes[oa]? definitiva/.test(text)) return "CANCELLED";
  if (/rinviat|rimandat|posticipat/.test(text)) return "POSTPONED";
  return null;
}

export function hasMatchResult(homeScore: number | null, awayScore: number | null): boolean {
  return homeScore != null && awayScore != null;
}

export function resolveMatchLifecycleStatus(input: {
  startAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  title: string;
  description?: string | null;
  wallNow: Date;
}): MatchLifecycleStatus {
  const hint = inferMatchScheduleHint(input.title, input.description);
  if (hint === "CANCELLED") return "CANCELLED";
  if (hint === "POSTPONED") return "POSTPONED";
  if (hasMatchResult(input.homeScore, input.awayScore)) return "PLAYED";
  if (input.startAt.getTime() >= input.wallNow.getTime()) return "UPCOMING";
  return "NO_RESULT";
}

export function matchPassesFilter(
  status: MatchLifecycleStatus,
  startAt: Date,
  wallNow: Date,
  filter: MatchListFilter,
): boolean {
  if (filter === "all") return true;
  const upcoming =
    startAt.getTime() >= wallNow.getTime() ||
    status === "UPCOMING" ||
    status === "POSTPONED";
  if (filter === "upcoming") {
    return upcoming && status !== "CANCELLED" && status !== "PLAYED";
  }
  // played: passate o con risultato (incluse annullate passate per storico)
  return startAt.getTime() < wallNow.getTime() || status === "PLAYED";
}

export function sortMatchesForFilter<T extends { startAt: Date }>(
  rows: T[],
  filter: MatchListFilter,
): T[] {
  const copy = [...rows];
  if (filter === "played") {
    copy.sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  } else {
    copy.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }
  return copy;
}

/**
 * Kickoff labels from Event.startAt wall-clock UTC fields (same convention as convocations).
 */
export function formatMatchKickoff(startAt: Date): { dateLabel: string; timeLabel: string } {
  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(startAt);
  const timeLabel = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(startAt);
  return { dateLabel, timeLabel };
}

export const CONVOCATION_RESPONSE_SHORT_LABEL: Record<
  "PENDING" | "PRESENT" | "ABSENT",
  string
> = {
  PENDING: "In attesa",
  PRESENT: "Presente",
  ABSENT: "Assente",
};

export type MatchAudience = "coach" | "parent";

/** Accesso lista/dettaglio partite mister: solo categorie assegnate. */
export function decideCoachMatchAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  categoryAssigned: boolean;
}): { ok: true } | { ok: false; status: 401 | 403 } {
  if (!input.authenticated) return { ok: false, status: 401 };
  if (input.role !== "COACH") return { ok: false, status: 403 };
  if (!input.categoryAssigned) return { ok: false, status: 403 };
  return { ok: true };
}

/** Accesso lista/dettaglio partite genitore: solo squadre dei figli. */
export function decideParentMatchAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  childInCategory: boolean;
}): { ok: true } | { ok: false; status: 401 | 403 } {
  if (!input.authenticated) return { ok: false, status: 401 };
  if (input.role !== "PARENT") return { ok: false, status: 403 };
  if (!input.childInCategory) return { ok: false, status: 403 };
  return { ok: true };
}

/**
 * Filtra valutazioni: mister vede tutti i giocatori della categoria;
 * genitore solo i figli (media sanitizzata, mai note).
 */
export function filterRatingsForAudience<T extends { athleteId: string }>(
  ratings: T[],
  audience: MatchAudience,
  allowedAthleteIds: ReadonlySet<string> | null,
): T[] {
  if (audience === "coach") return ratings;
  if (!allowedAthleteIds || allowedAthleteIds.size === 0) return [];
  return ratings.filter((row) => allowedAthleteIds.has(row.athleteId));
}

/** Filtra convocazioni: genitore vede solo i propri figli. */
export function filterConvocationsForAudience<T extends { athleteId: string }>(
  rows: T[],
  audience: MatchAudience,
  allowedAthleteIds: ReadonlySet<string> | null,
): T[] {
  if (audience === "coach") return rows;
  if (!allowedAthleteIds || allowedAthleteIds.size === 0) return [];
  return rows.filter((row) => allowedAthleteIds.has(row.athleteId));
}

export function venueSideLabel(isHome: boolean | null): string {
  if (isHome === true) return "Casa";
  if (isHome === false) return "Trasferta";
  return "Sede n/d";
}

export type ParentVisibleCardType = "YELLOW_CARD" | "RED_CARD" | "SECOND_YELLOW_RED";

export function isParentVisibleCardType(type: string): type is ParentVisibleCardType {
  return type === "YELLOW_CARD" || type === "RED_CARD" || type === "SECOND_YELLOW_RED";
}

export const PARENT_VISIBLE_CARD_LABEL: Record<ParentVisibleCardType, string> = {
  YELLOW_CARD: "Ammonizione",
  RED_CARD: "Espulsione",
  SECOND_YELLOW_RED: "Doppia ammonizione",
};
