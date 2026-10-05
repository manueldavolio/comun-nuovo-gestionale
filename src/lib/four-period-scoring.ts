/**
 * Scoring a 4 tempi (Pulcini / Esordienti).
 * Pure helpers — nessun storage. Persistenza: vedi MatchPeriodScore (proposta).
 */

export const FOUR_PERIOD_COUNT = 4;

export type CategoryNameLike = {
  name: string;
};

/**
 * Identifica categorie che usano il regolamento a 4 tempi.
 * Discriminante: Category.name (nessuno slug/enum dedicato nello schema).
 *
 * Riconosce varianti già viste in seed/migration:
 * Pulcini, Pulcini 2016, Esordienti, Esordienti U15, Esordienti 2014, …
 */
export function usesFourPeriodScoring(category: CategoryNameLike | string | null | undefined): boolean {
  const name = (typeof category === "string" ? category : category?.name ?? "").trim();
  if (!name) return false;

  const normalized = name.replace(/\s+/g, " ");
  // Inizio nome (caso tipico gestionale) oppure parola distinta.
  return /^(pulcini|esordienti)(?:$|[\s\-/0-9])/i.test(normalized);
}

/** Gol casa/trasferta di un singolo tempo; null = non inserito. */
export type PeriodScoreInput = {
  periodNumber: number;
  homeScore: number | null;
  awayScore: number | null;
};

export type PeriodPoints = {
  periodNumber: number;
  clubPoints: number;
  opponentPoints: number;
  clubGoals: number;
  opponentGoals: number;
};

/**
 * Punti di un tempo dal confronto gol Comun Nuovo vs Avversario
 * (indipendente da isHome: i gol devono già essere espressi lato club/opponent).
 */
export function periodPointsFromClubGoals(clubGoals: number, opponentGoals: number): {
  clubPoints: number;
  opponentPoints: number;
} {
  if (clubGoals > opponentGoals) return { clubPoints: 1, opponentPoints: 0 };
  if (clubGoals < opponentGoals) return { clubPoints: 0, opponentPoints: 1 };
  return { clubPoints: 1, opponentPoints: 1 };
}

/** Converte home/away + isHome in gol Comun Nuovo / avversario. */
export function clubOpponentGoalsFromHomeAway(input: {
  homeScore: number;
  awayScore: number;
  isHome: boolean | null;
}): { clubGoals: number; opponentGoals: number } {
  if (input.isHome === false) {
    return { clubGoals: input.awayScore, opponentGoals: input.homeScore };
  }
  // casa o null → Comun Nuovo sul lato home
  return { clubGoals: input.homeScore, opponentGoals: input.awayScore };
}

export function isPeriodEntered(period: {
  homeScore: number | null;
  awayScore: number | null;
}): boolean {
  return period.homeScore != null && period.awayScore != null;
}

/** Tutti e 4 i tempi (1..4) devono essere presenti e inseriti. */
export function isFourPeriodResultComplete(
  periods: Array<{ periodNumber: number; homeScore: number | null; awayScore: number | null }>,
): boolean {
  if (periods.length < FOUR_PERIOD_COUNT) return false;
  for (let n = 1; n <= FOUR_PERIOD_COUNT; n += 1) {
    const period = periods.find((row) => row.periodNumber === n);
    if (!period || !isPeriodEntered(period)) return false;
  }
  return true;
}

export function computeFourPeriodBreakdown(
  periods: PeriodScoreInput[],
  isHome: boolean | null,
): {
  complete: boolean;
  periodPoints: PeriodPoints[];
  finalClubPoints: number;
  finalOpponentPoints: number;
  realClubGoals: number;
  realOpponentGoals: number;
} {
  const periodPoints: PeriodPoints[] = [];
  let finalClubPoints = 0;
  let finalOpponentPoints = 0;
  let realClubGoals = 0;
  let realOpponentGoals = 0;

  const complete = isFourPeriodResultComplete(periods);

  for (let n = 1; n <= FOUR_PERIOD_COUNT; n += 1) {
    const period = periods.find((row) => row.periodNumber === n);
    if (!period || !isPeriodEntered(period)) {
      continue;
    }
    const mapped = clubOpponentGoalsFromHomeAway({
      homeScore: period.homeScore!,
      awayScore: period.awayScore!,
      isHome,
    });
    const points = periodPointsFromClubGoals(mapped.clubGoals, mapped.opponentGoals);
    periodPoints.push({
      periodNumber: n,
      clubPoints: points.clubPoints,
      opponentPoints: points.opponentPoints,
      clubGoals: mapped.clubGoals,
      opponentGoals: mapped.opponentGoals,
    });
    finalClubPoints += points.clubPoints;
    finalOpponentPoints += points.opponentPoints;
    realClubGoals += mapped.clubGoals;
    realOpponentGoals += mapped.opponentGoals;
  }

  return {
    complete,
    periodPoints,
    finalClubPoints,
    finalOpponentPoints,
    realClubGoals,
    realOpponentGoals,
  };
}

export function countEnteredPeriods(
  periods: Array<{ periodNumber: number; homeScore: number | null; awayScore: number | null }>,
): number {
  let count = 0;
  for (let n = 1; n <= FOUR_PERIOD_COUNT; n += 1) {
    const period = periods.find((row) => row.periodNumber === n);
    if (period && isPeriodEntered(period)) count += 1;
  }
  return count;
}

/** Punti-tempo club/opponent → home/away Event (dual-write). */
export function finalPeriodPointsAsHomeAway(input: {
  finalClubPoints: number;
  finalOpponentPoints: number;
  isHome: boolean | null;
}): { homeScore: number; awayScore: number } {
  if (input.isHome === false) {
    return {
      homeScore: input.finalOpponentPoints,
      awayScore: input.finalClubPoints,
    };
  }
  return {
    homeScore: input.finalClubPoints,
    awayScore: input.finalOpponentPoints,
  };
}

/** Gol UI club/opponent → home/away DB per un tempo. */
export function clubOpponentToHomeAway(input: {
  clubGoals: number;
  opponentGoals: number;
  isHome: boolean | null;
}): { homeScore: number; awayScore: number } {
  if (input.isHome === false) {
    return { homeScore: input.opponentGoals, awayScore: input.clubGoals };
  }
  return { homeScore: input.clubGoals, awayScore: input.opponentGoals };
}

/**
 * Dual-write Event scores from periods.
 * Incomplete → both null. Complete → punti-tempo come home/away.
 */
export function resolveEventScoresFromPeriods(
  periods: PeriodScoreInput[],
  isHome: boolean | null,
): { homeScore: number | null; awayScore: number | null; breakdown: ReturnType<typeof computeFourPeriodBreakdown> } {
  const breakdown = computeFourPeriodBreakdown(periods, isHome);
  if (!breakdown.complete) {
    return { homeScore: null, awayScore: null, breakdown };
  }
  const mapped = finalPeriodPointsAsHomeAway({
    finalClubPoints: breakdown.finalClubPoints,
    finalOpponentPoints: breakdown.finalOpponentPoints,
    isHome,
  });
  return { homeScore: mapped.homeScore, awayScore: mapped.awayScore, breakdown };
}

/** Etichette compatte tempi per genitore: "1-0 · 1-0 · …" (vista club-opponent). */
export function formatPeriodScoresDetail(
  periods: PeriodScoreInput[],
  isHome: boolean | null,
): string | null {
  if (!isFourPeriodResultComplete(periods)) return null;
  const parts: string[] = [];
  for (let n = 1; n <= FOUR_PERIOD_COUNT; n += 1) {
    const period = periods.find((row) => row.periodNumber === n)!;
    const mapped = clubOpponentGoalsFromHomeAway({
      homeScore: period.homeScore!,
      awayScore: period.awayScore!,
      isHome,
    });
    parts.push(`${mapped.clubGoals}-${mapped.opponentGoals}`);
  }
  return parts.join(" · ");
}

/**
 * Soft hint gol: confronta gol REALI Comun Nuovo (somma tempi) con MatchPlayerStat.
 * Non usare mai i punti-tempo.
 */
export function shouldShowSoftStatsHintFromRealGoals(input: {
  realClubGoals: number | null;
  playerGoalsSum: number;
}): boolean {
  if (input.realClubGoals == null || input.realClubGoals <= 0) return false;
  return input.playerGoalsSum <= 0;
}

/**
 * Payload risultato classico per API attendance.
 * - resultEntered=false → NON inviare homeScore/awayScore (restano null in DB).
 * - resultEntered=true → invia gli score (anche 0-0).
 */
export function buildClassicMatchResultPayload(input: {
  resultEntered: boolean;
  clubScore: number;
  opponentScore: number;
  isHome: boolean;
  opponentName: string | null;
}): {
  opponentName: string | null;
  isHome: boolean;
  homeScore?: number;
  awayScore?: number;
} {
  const homeScore = input.isHome ? input.clubScore : input.opponentScore;
  const awayScore = input.isHome ? input.opponentScore : input.clubScore;
  const base = {
    opponentName: input.opponentName,
    isHome: input.isHome,
  };
  if (!input.resultEntered) {
    return base;
  }
  return { ...base, homeScore, awayScore };
}
