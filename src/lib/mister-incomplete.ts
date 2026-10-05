import { isMatchEventType, MATCH_EVENT_TYPES } from "@/lib/parent-season";
import { resolveMatchVisualEndAt } from "@/lib/match-day";
import {
  countEnteredPeriods,
  FOUR_PERIOD_COUNT,
  isFourPeriodResultComplete,
  shouldShowSoftStatsHintFromRealGoals,
  usesFourPeriodScoring,
  type PeriodScoreInput,
} from "@/lib/four-period-scoring";

export const INCOMPLETE_MATCH_LOOKBACK_DAYS = 21;
export const INCOMPLETE_MATCH_MAX_ITEMS = 8;

export type IncompleteMatchReason = "MISSING_ATTENDANCE" | "MISSING_RESULT";

export type IncompleteMatchCandidate = {
  id: string;
  type: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  categoryId: string | null;
  categoryName?: string | null;
  opponentName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  isHome: boolean | null;
  attendanceCount: number;
  /** Somma gol MatchPlayerStat per l'evento (0 se nessuna riga). */
  playerGoalsSum: number;
  /** Periodi MatchPeriodScore (Pulcini/Esordienti). */
  periodScores?: PeriodScoreInput[];
  /**
   * Gol reali Comun Nuovo dai 4 tempi (solo Pulcini/Esordienti, quando disponibili).
   */
  realClubGoalsFromPeriods?: number | null;
};

export type IncompleteMatchRow = IncompleteMatchCandidate & {
  reasons: IncompleteMatchReason[];
  softStatsHint: boolean;
  periodsEntered?: number;
  periodsTotal?: number;
};

/** Gol di Comun Nuovo dal risultato strutturato; null se risultato incompleto. */
export function clubGoalsFromResult(input: {
  homeScore: number | null;
  awayScore: number | null;
  isHome: boolean | null;
}): number | null {
  if (input.homeScore == null || input.awayScore == null) {
    return null;
  }
  if (input.isHome === false) {
    return input.awayScore;
  }
  return input.homeScore;
}

export function hasSavedAttendance(attendanceCount: number): boolean {
  return attendanceCount > 0;
}

export function hasSavedResult(input: {
  homeScore: number | null;
  awayScore: number | null;
}): boolean {
  return input.homeScore != null && input.awayScore != null;
}

export function hasSavedFourPeriodResult(periods: PeriodScoreInput[] | undefined): boolean {
  return isFourPeriodResultComplete(periods ?? []);
}

/** Hard incomplete: niente Attendance oppure risultato mancante (classico o periodi). */
export function resolveIncompleteReasons(input: {
  attendanceCount: number;
  homeScore: number | null;
  awayScore: number | null;
  categoryName?: string | null;
  periodScores?: PeriodScoreInput[];
}): IncompleteMatchReason[] {
  const reasons: IncompleteMatchReason[] = [];
  if (!hasSavedAttendance(input.attendanceCount)) {
    reasons.push("MISSING_ATTENDANCE");
  }

  const fourPeriod = usesFourPeriodScoring(input.categoryName);
  const resultOk = fourPeriod
    ? hasSavedFourPeriodResult(input.periodScores)
    : hasSavedResult(input);

  if (!resultOk) {
    reasons.push("MISSING_RESULT");
  }
  return reasons;
}

/**
 * Soft hint: club ha segnato ≥1 ma nessun gol in MatchPlayerStat.
 * Pulcini/Esordienti: usa gol reali dai periodi, mai Event punti-tempo.
 */
export function shouldShowSoftStatsHint(input: {
  homeScore: number | null;
  awayScore: number | null;
  isHome: boolean | null;
  playerGoalsSum: number;
  categoryName?: string | null;
  realClubGoalsFromPeriods?: number | null;
  periodScores?: PeriodScoreInput[];
}): boolean {
  if (usesFourPeriodScoring(input.categoryName)) {
    if (!hasSavedFourPeriodResult(input.periodScores)) {
      return false;
    }
    return shouldShowSoftStatsHintFromRealGoals({
      realClubGoals: input.realClubGoalsFromPeriods ?? null,
      playerGoalsSum: input.playerGoalsSum,
    });
  }
  const clubGoals = clubGoalsFromResult(input);
  if (clubGoals == null || clubGoals <= 0) {
    return false;
  }
  return input.playerGoalsSum <= 0;
}

export function isPastOrFinishedMatch(input: {
  startAt: Date;
  endAt: Date | null;
  wallNow: Date;
}): boolean {
  const effectiveEnd = resolveMatchVisualEndAt(input.startAt, input.endAt);
  return input.wallNow.getTime() > effectiveEnd.getTime() || input.startAt.getTime() < input.wallNow.getTime();
}

export function isWithinLookbackDays(startAt: Date, wallNow: Date, days = INCOMPLETE_MATCH_LOOKBACK_DAYS) {
  const lookbackMs = days * 24 * 60 * 60 * 1000;
  return wallNow.getTime() - startAt.getTime() <= lookbackMs && startAt.getTime() <= wallNow.getTime() + lookbackMs;
}

export function selectIncompleteMatches(
  candidates: IncompleteMatchCandidate[],
  options: {
    allowedCategoryIds: string[];
    wallNow: Date;
    lookbackDays?: number;
    maxItems?: number;
  },
): IncompleteMatchRow[] {
  const lookbackDays = options.lookbackDays ?? INCOMPLETE_MATCH_LOOKBACK_DAYS;
  const maxItems = options.maxItems ?? INCOMPLETE_MATCH_MAX_ITEMS;
  const allowed = new Set(options.allowedCategoryIds);
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
  const earliest = options.wallNow.getTime() - lookbackMs;

  const rows: IncompleteMatchRow[] = [];

  for (const candidate of candidates) {
    if (!isMatchEventType(candidate.type)) continue;
    if (!candidate.categoryId || !allowed.has(candidate.categoryId)) continue;
    if (candidate.startAt.getTime() < earliest) continue;
    if (
      !isPastOrFinishedMatch({
        startAt: candidate.startAt,
        endAt: candidate.endAt,
        wallNow: options.wallNow,
      })
    ) {
      continue;
    }

    const reasons = resolveIncompleteReasons(candidate);
    if (reasons.length === 0) continue;

    const fourPeriod = usesFourPeriodScoring(candidate.categoryName);
    rows.push({
      ...candidate,
      reasons,
      softStatsHint: shouldShowSoftStatsHint(candidate),
      ...(fourPeriod
        ? {
            periodsEntered: countEnteredPeriods(candidate.periodScores ?? []),
            periodsTotal: FOUR_PERIOD_COUNT,
          }
        : {}),
    });
  }

  rows.sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  return rows.slice(0, maxItems);
}

export function softStatsHintForCompleteMatch(input: {
  homeScore: number | null;
  awayScore: number | null;
  isHome: boolean | null;
  playerGoalsSum: number;
  categoryName?: string | null;
  realClubGoalsFromPeriods?: number | null;
  periodScores?: PeriodScoreInput[];
}): boolean {
  if (usesFourPeriodScoring(input.categoryName)) {
    if (!hasSavedFourPeriodResult(input.periodScores)) return false;
    return shouldShowSoftStatsHintFromRealGoals({
      realClubGoals: input.realClubGoalsFromPeriods ?? null,
      playerGoalsSum: input.playerGoalsSum,
    });
  }
  if (!hasSavedResult(input)) return false;
  return shouldShowSoftStatsHint(input);
}

export function clampStepperValue(value: number, min = 0, max = 99): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function stepValue(current: number, delta: number, min = 0, max = 99): number {
  return clampStepperValue(current + delta, min, max);
}

export function normalizeStatsForStatus(input: {
  status: string;
  goals: number;
  assists: number;
}): { goals: number; assists: number } {
  if (input.status !== "PRESENT") {
    return { goals: 0, assists: 0 };
  }
  return {
    goals: clampStepperValue(input.goals),
    assists: clampStepperValue(input.assists),
  };
}

export { MATCH_EVENT_TYPES, FOUR_PERIOD_COUNT };
