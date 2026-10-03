import type { AttendanceStatus, EventType } from "@prisma/client";

export const MATCH_EVENT_TYPES: EventType[] = ["LEAGUE_MATCH", "FRIENDLY", "TOURNAMENT"];

export function isMatchEventType(type: EventType | string): boolean {
  return MATCH_EVENT_TYPES.includes(type as EventType);
}

/** Stagione sportiva IT: 1 agosto → 31 luglio (wall-clock UTC). */
export function currentSeasonRange(now = new Date()): { start: Date; end: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startYear = month >= 7 ? year : year - 1;
  return {
    start: new Date(Date.UTC(startYear, 7, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(startYear + 1, 6, 31, 23, 59, 59, 999)),
  };
}

export type SeasonAthleteStats = {
  matchPresences: number;
  goals: number;
  assists: number;
  trainingMarked: number;
  trainingPresent: number;
  trainingPercent: number | null;
};

export function emptySeasonStats(): SeasonAthleteStats {
  return {
    matchPresences: 0,
    goals: 0,
    assists: 0,
    trainingMarked: 0,
    trainingPresent: 0,
    trainingPercent: null,
  };
}

export function computeSeasonAthleteStats(input: {
  attendances: Array<{ status: AttendanceStatus; eventType: EventType }>;
  matchStats: Array<{ goals: number; assists: number }>;
}): SeasonAthleteStats {
  const stats = emptySeasonStats();

  for (const row of input.attendances) {
    if (row.eventType === "TRAINING") {
      stats.trainingMarked += 1;
      if (row.status === "PRESENT") {
        stats.trainingPresent += 1;
      }
    } else if (isMatchEventType(row.eventType) && row.status === "PRESENT") {
      stats.matchPresences += 1;
    }
  }

  for (const row of input.matchStats) {
    stats.goals += Math.max(0, row.goals);
    stats.assists += Math.max(0, row.assists);
  }

  stats.trainingPercent =
    stats.trainingMarked > 0
      ? Math.round((stats.trainingPresent / stats.trainingMarked) * 100)
      : null;

  return stats;
}

export type SeasonBadge = {
  id: string;
  label: string;
};

export function computeSeasonBadges(stats: SeasonAthleteStats): SeasonBadge[] {
  const badges: SeasonBadge[] = [];

  if (stats.matchPresences >= 1) {
    badges.push({ id: "first-match", label: "Prima presenza" });
  }
  if (stats.goals >= 1) {
    badges.push({ id: "first-goal", label: "Primo gol" });
  }
  if (stats.matchPresences >= 5) {
    badges.push({ id: "matches-5", label: "5 presenze" });
  }
  if (stats.matchPresences >= 10) {
    badges.push({ id: "matches-10", label: "10 presenze" });
  }
  if (stats.goals >= 5) {
    badges.push({ id: "goals-5", label: "5 gol" });
  }
  if (stats.assists >= 5) {
    badges.push({ id: "assists-5", label: "5 assist" });
  }
  if (stats.trainingPresent >= 10) {
    badges.push({ id: "trainings-10", label: "10 allenamenti" });
  }
  if (stats.trainingPercent != null && stats.trainingPercent >= 90 && stats.trainingMarked >= 5) {
    badges.push({ id: "training-90", label: "90% allenamenti" });
  }

  return badges;
}

export function formatMatchResultLabel(input: {
  clubName?: string;
  opponentName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  isHome: boolean | null;
  fallbackTitle: string;
}): string | null {
  if (input.homeScore == null || input.awayScore == null) {
    return null;
  }

  const club = (input.clubName ?? "Comun Nuovo").trim() || "Comun Nuovo";
  const opponent = (input.opponentName ?? "").trim() || "Avversario";

  if (input.isHome === false) {
    return `${opponent} ${input.homeScore} - ${input.awayScore} ${club}`;
  }

  // Default / isHome true: club listed first as home.
  return `${club} ${input.homeScore} - ${input.awayScore} ${opponent}`;
}

export function athleteInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}
