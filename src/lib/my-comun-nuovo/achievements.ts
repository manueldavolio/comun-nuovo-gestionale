import type { AttendanceStatus } from "@prisma/client";
import { isGoalkeeperRole } from "@/lib/athlete-roles";
import {
  computeSeasonBadges,
  type SeasonAthleteStats,
  type SeasonBadge,
} from "@/lib/parent-season";

/**
 * Traguardi derivati (nessuna tabella DB).
 * Focus su presenza/costanza; niente confronti tra bambini.
 */
export function computeMyComunAchievements(input: {
  stats: SeasonAthleteStats;
  position: string | null;
  /** Stati allenamento marcati in ordine cronologico (solo row Attendance esistenti). */
  trainingStatusesChronological?: AttendanceStatus[];
  /** Numero di clean sheet confermati (POR PRESENT + goalsConceded === 0). */
  cleanSheetCount?: number;
}): SeasonBadge[] {
  const base = computeSeasonBadges(input.stats);
  const seen = new Set(base.map((b) => b.id));
  const badges = [...base];

  const push = (id: string, label: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    badges.push({ id, label });
  };

  if (input.stats.assists >= 1) {
    push("first-assist", "Primo assist");
  }
  if (input.stats.matchPresences >= 25) {
    push("matches-25", "25 presenze");
  }
  if (input.stats.trainingPresent >= 5) {
    push("trainings-5", "5 allenamenti");
  }

  const streak = longestPresentStreak(input.trainingStatusesChronological ?? []);
  if (streak >= 5) {
    push("training-streak-5", "5 allenamenti consecutivi");
  }

  if (
    isGoalkeeperRole(input.position) &&
    (input.cleanSheetCount ?? 0) >= 1
  ) {
    push("clean-sheet", "Clean sheet");
  }

  return badges;
}

export function longestPresentStreak(statuses: AttendanceStatus[]): number {
  let best = 0;
  let current = 0;
  for (const status of statuses) {
    if (status === "PRESENT") {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

export type RecentMatchChip = {
  id: string;
  startAt: Date;
  present: boolean;
  goals: number;
  assists: number;
  hasResult: boolean;
  opponentLabel: string;
};

export function buildRecentMatchChips(
  matches: Array<{
    id: string;
    startAt: Date;
    opponentName: string | null;
    title: string;
    homeScore: number | null;
    awayScore: number | null;
    attendanceStatus: AttendanceStatus | null | undefined;
    goals: number;
    assists: number;
  }>,
): RecentMatchChip[] {
  return matches.map((match) => ({
    id: match.id,
    startAt: match.startAt,
    present: match.attendanceStatus === "PRESENT",
    goals: Math.max(0, match.goals),
    assists: Math.max(0, match.assists),
    hasResult: match.homeScore != null && match.awayScore != null,
    opponentLabel: (match.opponentName ?? "").trim() || "Partita",
  }));
}
