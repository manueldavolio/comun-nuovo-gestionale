import type { UserRole } from "@prisma/client";
import {
  averageOfAverages,
  averagePresentScores,
  type MatchRatingScores,
} from "@/lib/match-player-rating";

/**
 * DTO sanitizzato per la dashboard genitore.
 * Non include note del mister né i campi grezzi MatchPlayerRating (anti-leak).
 */
export type ParentMatchRatingDetail = {
  eventId: string;
  startAt: string;
  opponentLabel: string;
  matchAverage: number;
};

export type ParentSeasonRatingSummary = {
  /** Media dei voti partita (solo partite con almeno un criterio). null → UI "—". */
  mediaVoti: number | null;
  ratedMatchCount: number;
  matches: ParentMatchRatingDetail[];
};

export type ParentMatchRatingRowInput = MatchRatingScores & {
  eventId: string;
  startAt: Date;
  opponentName: string | null;
  title: string;
};

export function opponentLabelForParentRating(input: {
  opponentName: string | null;
  title: string;
}): string {
  const opponent = (input.opponentName ?? "").trim();
  if (opponent) return opponent;
  const title = input.title.trim();
  return title || "Partita";
}

/**
 * Costruisce media e dettaglio dai soli voti reali presenti.
 * Partite senza alcun criterio valorizzato sono escluse dalla media.
 */
export function buildParentSeasonRatingSummary(
  rows: ParentMatchRatingRowInput[],
): ParentSeasonRatingSummary {
  const matches: ParentMatchRatingDetail[] = [];

  for (const row of rows) {
    const matchAverage = averagePresentScores({
      possessionScore: row.possessionScore,
      outOfPossessionScore: row.outOfPossessionScore,
      attitudeScore: row.attitudeScore,
      teamworkScore: row.teamworkScore,
    });
    if (matchAverage == null) continue;
    matches.push({
      eventId: row.eventId,
      startAt: row.startAt.toISOString(),
      opponentLabel: opponentLabelForParentRating({
        opponentName: row.opponentName,
        title: row.title,
      }),
      matchAverage,
    });
  }

  matches.sort((a, b) => (a.startAt < b.startAt ? 1 : a.startAt > b.startAt ? -1 : 0));

  return {
    mediaVoti: averageOfAverages(matches.map((row) => row.matchAverage)),
    ratedMatchCount: matches.length,
    matches,
  };
}

export function formatParentRatingAverage(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

export function decideParentAthleteRatingsAccess(input: {
  authenticated: boolean;
  role: UserRole | null | undefined;
  parentAssociatedToAthlete: boolean;
}): { ok: true } | { ok: false; status: 401 | 403 } {
  if (!input.authenticated) return { ok: false, status: 401 };
  if (input.role !== "PARENT") return { ok: false, status: 403 };
  if (!input.parentAssociatedToAthlete) return { ok: false, status: 403 };
  return { ok: true };
}
