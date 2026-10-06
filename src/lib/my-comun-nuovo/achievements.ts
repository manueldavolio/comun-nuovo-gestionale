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
  if (input.stats.trainingPresent >= 25) {
    push("trainings-25", "25 allenamenti");
  }

  const streak = longestPresentStreak(input.trainingStatusesChronological ?? []);
  if (streak >= 5) {
    push("training-streak-5", "5 allenamenti consecutivi");
  }

  const cleanSheets = input.cleanSheetCount ?? 0;
  if (isGoalkeeperRole(input.position) && cleanSheets >= 1) {
    push("clean-sheet", "Prima porta inviolata");
  }
  if (isGoalkeeperRole(input.position) && cleanSheets >= 5) {
    push("clean-sheet-5", "5 porte inviolate");
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

export type GrowthPathMilestone = {
  id: string;
  label: string;
  reached: boolean;
  /** Progresso personale verso il traguardo (mai ranking). */
  current?: number;
  target?: number;
  progressLabel?: string | null;
};

type PathDefinition = {
  id: string;
  label: string;
  /** Se false, milestone nascosta (es. POR-only). */
  enabled?: boolean;
  current: number;
  target: number;
};

/**
 * Percorso personale: traguardi raggiunti + prossimi (progresso individuale).
 * Nessun confronto, ranking o percentile.
 */
export function buildAthleteGrowthPath(input: {
  stats: SeasonAthleteStats;
  position: string | null;
  trainingStatusesChronological?: AttendanceStatus[];
  cleanSheetCount?: number;
  /** Quanti "prossimi" mostrare al massimo. */
  nextLimit?: number;
}): { reached: GrowthPathMilestone[]; next: GrowthPathMilestone[] } {
  const streak = longestPresentStreak(input.trainingStatusesChronological ?? []);
  const cleanSheets = input.cleanSheetCount ?? 0;
  const isPor = isGoalkeeperRole(input.position);

  const definitions: PathDefinition[] = [
    {
      id: "first-match",
      label: "Prima presenza",
      current: input.stats.matchPresences,
      target: 1,
    },
    {
      id: "trainings-5",
      label: "5 allenamenti",
      current: input.stats.trainingPresent,
      target: 5,
    },
    {
      id: "trainings-10",
      label: "10 allenamenti",
      current: input.stats.trainingPresent,
      target: 10,
    },
    {
      id: "trainings-25",
      label: "25 allenamenti",
      current: input.stats.trainingPresent,
      target: 25,
    },
    {
      id: "matches-10",
      label: "10 partite",
      current: input.stats.matchPresences,
      target: 10,
    },
    {
      id: "matches-25",
      label: "25 partite",
      current: input.stats.matchPresences,
      target: 25,
    },
    {
      id: "first-goal",
      label: "Primo gol",
      current: input.stats.goals,
      target: 1,
    },
    {
      id: "first-assist",
      label: "Primo assist",
      current: input.stats.assists,
      target: 1,
    },
    {
      id: "goals-5",
      label: "5 gol",
      current: input.stats.goals,
      target: 5,
    },
    {
      id: "assists-5",
      label: "5 assist",
      current: input.stats.assists,
      target: 5,
    },
    {
      id: "training-streak-5",
      label: "5 allenamenti consecutivi",
      current: streak,
      target: 5,
    },
    {
      id: "clean-sheet",
      label: "Prima porta inviolata",
      enabled: isPor,
      current: cleanSheets,
      target: 1,
    },
    {
      id: "clean-sheet-5",
      label: "5 porte inviolate",
      enabled: isPor,
      current: cleanSheets,
      target: 5,
    },
  ];

  const reached: GrowthPathMilestone[] = [];
  const next: GrowthPathMilestone[] = [];
  const nextLimit = input.nextLimit ?? 3;

  for (const def of definitions) {
    if (def.enabled === false) continue;
    const milestoneReached = def.current >= def.target;
    const progressLabel =
      def.target > 1
        ? `${Math.min(def.current, def.target)}/${def.target}`
        : null;
    const item: GrowthPathMilestone = {
      id: def.id,
      label: def.label,
      reached: milestoneReached,
      current: def.current,
      target: def.target,
      progressLabel: milestoneReached ? null : progressLabel,
    };
    if (milestoneReached) {
      reached.push(item);
    } else if (next.length < nextLimit) {
      next.push(item);
    }
  }

  return { reached, next };
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
