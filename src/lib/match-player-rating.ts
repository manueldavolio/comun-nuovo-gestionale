/**
 * Valutazioni postpartita (1–10). Criteri assenti = non valutati (mai 0 automatico).
 * Inserimento e note riservati allo staff. La media partita può essere mostrata
 * ai genitori solo tramite DTO sanitizzato (`parent-match-ratings`), senza note.
 */

export const MATCH_RATING_CRITERIA = [
  "possessionScore",
  "outOfPossessionScore",
  "attitudeScore",
  "teamworkScore",
] as const;

export type MatchRatingCriterion = (typeof MATCH_RATING_CRITERIA)[number];

export const MATCH_RATING_CRITERION_LABEL: Record<MatchRatingCriterion, string> = {
  possessionScore: "Fase di possesso",
  outOfPossessionScore: "Fase di non possesso",
  attitudeScore: "Atteggiamento",
  teamworkScore: "Gioco di squadra",
};

export type MatchRatingScores = {
  possessionScore: number | null;
  outOfPossessionScore: number | null;
  attitudeScore: number | null;
  teamworkScore: number | null;
};

export function normalizeRatingScore(
  value: unknown,
): { ok: true; score: number | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, score: null };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
    return { ok: false, error: "Voto non valido (1–10 oppure vuoto)." };
  }
  return { ok: true, score: value };
}

export function normalizeMatchRatingScores(input: {
  possessionScore: unknown;
  outOfPossessionScore: unknown;
  attitudeScore: unknown;
  teamworkScore: unknown;
}): { ok: true; scores: MatchRatingScores } | { ok: false; error: string } {
  const possession = normalizeRatingScore(input.possessionScore);
  if (!possession.ok) return possession;
  const outOfPossession = normalizeRatingScore(input.outOfPossessionScore);
  if (!outOfPossession.ok) return outOfPossession;
  const attitude = normalizeRatingScore(input.attitudeScore);
  if (!attitude.ok) return attitude;
  const teamwork = normalizeRatingScore(input.teamworkScore);
  if (!teamwork.ok) return teamwork;

  return {
    ok: true,
    scores: {
      possessionScore: possession.score,
      outOfPossessionScore: outOfPossession.score,
      attitudeScore: attitude.score,
      teamworkScore: teamwork.score,
    },
  };
}

/** Media dei soli voti presenti. null se nessun criterio valorizzato. */
export function averagePresentScores(scores: MatchRatingScores): number | null {
  const values = MATCH_RATING_CRITERIA.map((key) => scores[key]).filter(
    (value): value is number => typeof value === "number",
  );
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function averageOfAverages(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => typeof value === "number");
  if (present.length === 0) return null;
  const sum = present.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / present.length) * 10) / 10;
}

export type CriterionSeasonAverages = {
  possession: number | null;
  outOfPossession: number | null;
  attitude: number | null;
  teamwork: number | null;
  overall: number | null;
};

export function computeCriterionSeasonAverages(
  rows: MatchRatingScores[],
): CriterionSeasonAverages {
  const collect = (key: MatchRatingCriterion) =>
    rows
      .map((row) => row[key])
      .filter((value): value is number => typeof value === "number");

  const avg = (nums: number[]) =>
    nums.length === 0
      ? null
      : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;

  const possession = avg(collect("possessionScore"));
  const outOfPossession = avg(collect("outOfPossessionScore"));
  const attitude = avg(collect("attitudeScore"));
  const teamwork = avg(collect("teamworkScore"));
  const overall = averageOfAverages(
    rows.map((row) => averagePresentScores(row)),
  );

  return { possession, outOfPossession, attitude, teamwork, overall };
}

export function hasAnyScore(scores: MatchRatingScores): boolean {
  return MATCH_RATING_CRITERIA.some((key) => scores[key] != null);
}

export function normalizeOptionalRatingNotes(
  value: unknown,
  max = 500,
): { ok: true; notes: string | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, notes: null };
  if (typeof value !== "string") return { ok: false, error: "Note non valide." };
  const notes = value.trim().replace(/\s+/g, " ");
  if (!notes) return { ok: true, notes: null };
  if (notes.length > max) {
    return { ok: false, error: `Note troppo lunghe (max ${max}).` };
  }
  return { ok: true, notes };
}
