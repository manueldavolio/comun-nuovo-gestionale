import type { AttendanceStatus, CompetitionKind, EventType } from "@prisma/client";
import { isMatchEventType } from "@/lib/parent-season";
import {
  averagePresentScores,
  computeCriterionSeasonAverages,
  type MatchRatingScores,
} from "@/lib/match-player-rating";
import type { DisciplineTotals } from "@/lib/discipline";

export type MisterSeasonAthleteRow = {
  athleteId: string;
  fullName: string;
  trainingMarked: number;
  trainingPresent: number;
  matchMarked: number;
  matchPresent: number;
  presencePercent: number | null;
  goals: number;
  yellowCards: number;
  redCards: number;
  remainingSuspensions: number;
  ratingOverall: number | null;
  ratingByCriterion: {
    possession: number | null;
    outOfPossession: number | null;
    attitude: number | null;
    teamwork: number | null;
  };
};

function presencePercent(present: number, marked: number): number | null {
  if (marked <= 0) return null;
  return Math.round((present / marked) * 100);
}

export function buildMisterSeasonAthleteStats(input: {
  athletes: Array<{ id: string; firstName: string; lastName: string }>;
  attendances: Array<{
    athleteId: string;
    status: AttendanceStatus;
    eventType: EventType;
  }>;
  matchStats: Array<{ athleteId: string; goals: number }>;
  ratings: Array<{ athleteId: string } & MatchRatingScores>;
  disciplineByAthlete: Map<
    string,
    DisciplineTotals & { remainingSuspensions: number }
  >;
}): MisterSeasonAthleteRow[] {
  type Acc = {
    trainingMarked: number;
    trainingPresent: number;
    matchMarked: number;
    matchPresent: number;
    goals: number;
    ratings: MatchRatingScores[];
  };

  const byAthlete = new Map<string, Acc>();

  const ensure = (athleteId: string): Acc => {
    const current = byAthlete.get(athleteId);
    if (current) return current;
    const created: Acc = {
      trainingMarked: 0,
      trainingPresent: 0,
      matchMarked: 0,
      matchPresent: 0,
      goals: 0,
      ratings: [],
    };
    byAthlete.set(athleteId, created);
    return created;
  };

  for (const row of input.attendances) {
    const acc = ensure(row.athleteId);
    if (row.eventType === "TRAINING") {
      acc.trainingMarked += 1;
      if (row.status === "PRESENT") acc.trainingPresent += 1;
    } else if (isMatchEventType(row.eventType)) {
      acc.matchMarked += 1;
      if (row.status === "PRESENT") acc.matchPresent += 1;
    }
  }

  for (const row of input.matchStats) {
    ensure(row.athleteId).goals += Math.max(0, row.goals);
  }

  for (const row of input.ratings) {
    ensure(row.athleteId).ratings.push({
      possessionScore: row.possessionScore,
      outOfPossessionScore: row.outOfPossessionScore,
      attitudeScore: row.attitudeScore,
      teamworkScore: row.teamworkScore,
    });
  }

  return input.athletes
    .map((athlete) => {
      const acc = byAthlete.get(athlete.id) ?? ensure(athlete.id);
      const marked = acc.trainingMarked + acc.matchMarked;
      const present = acc.trainingPresent + acc.matchPresent;
      const ratingAvgs = computeCriterionSeasonAverages(acc.ratings);
      const discipline = input.disciplineByAthlete.get(athlete.id);

      return {
        athleteId: athlete.id,
        fullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        trainingMarked: acc.trainingMarked,
        trainingPresent: acc.trainingPresent,
        matchMarked: acc.matchMarked,
        matchPresent: acc.matchPresent,
        presencePercent: presencePercent(present, marked),
        goals: acc.goals,
        yellowCards: discipline?.yellowCards ?? 0,
        redCards: discipline?.redCards ?? 0,
        remainingSuspensions: discipline?.remainingSuspensions ?? 0,
        ratingOverall: ratingAvgs.overall,
        ratingByCriterion: {
          possession: ratingAvgs.possession,
          outOfPossession: ratingAvgs.outOfPossession,
          attitude: ratingAvgs.attitude,
          teamwork: ratingAvgs.teamwork,
        },
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));
}

export function filterAttendancesByCompetition(params: {
  rows: Array<{
    athleteId: string;
    status: AttendanceStatus;
    eventType: EventType;
    competitionKind: CompetitionKind | null;
  }>;
  competitionKind: CompetitionKind | "ALL";
}): Array<{
  athleteId: string;
  status: AttendanceStatus;
  eventType: EventType;
}> {
  if (params.competitionKind === "ALL") {
    return params.rows.map(({ athleteId, status, eventType }) => ({
      athleteId,
      status,
      eventType,
    }));
  }
  return params.rows
    .filter((row) => {
      if (row.eventType === "TRAINING") return true;
      return row.competitionKind === params.competitionKind;
    })
    .map(({ athleteId, status, eventType }) => ({ athleteId, status, eventType }));
}

export { averagePresentScores };
