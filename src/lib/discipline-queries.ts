import type { CompetitionKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeDisciplineTotals,
  remainingMatchdays,
  totalRemainingMatchdays,
  type IncidentForTotals,
} from "@/lib/discipline";

export async function loadAthleteDisciplineSummary(params: {
  athleteId: string;
  seasonLabel: string;
  competitionKind: CompetitionKind;
}) {
  const [opening, incidents, suspensions] = await Promise.all([
    prisma.disciplinaryOpeningBalance.findUnique({
      where: {
        athleteId_seasonLabel_competitionKind: {
          athleteId: params.athleteId,
          seasonLabel: params.seasonLabel,
          competitionKind: params.competitionKind,
        },
      },
    }),
    prisma.disciplinaryIncident.findMany({
      where: {
        athleteId: params.athleteId,
        seasonLabel: params.seasonLabel,
        competitionKind: params.competitionKind,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        event: { select: { id: true, title: true, startAt: true } },
      },
    }),
    prisma.disciplinarySuspension.findMany({
      where: {
        athleteId: params.athleteId,
        seasonLabel: params.seasonLabel,
        competitionKind: params.competitionKind,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        servings: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            event: { select: { id: true, title: true, startAt: true } },
          },
        },
      },
    }),
  ]);

  const incidentRows: IncidentForTotals[] = incidents.map((row) => ({
    type: row.type,
    status: row.status,
    eventStartAt: row.event?.startAt ?? null,
    createdAt: row.createdAt,
  }));

  const totals = computeDisciplineTotals({
    opening: opening
      ? {
          priorYellowCards: opening.priorYellowCards,
          priorYellowCardsForAccumulation: opening.priorYellowCardsForAccumulation,
          priorRedCards: opening.priorRedCards,
          openSuspensionMatchdays: opening.openSuspensionMatchdays,
          referenceDate: opening.referenceDate,
        }
      : null,
    incidents: incidentRows,
  });

  const suspensionRows = suspensions.map((row) => ({
    status: row.status,
    matchdaysTotal: row.matchdaysTotal,
    servings: row.servings.map((serving) => ({ status: serving.status })),
  }));

  // openSuspensionMatchdays dell'apertura: conteggiato solo se non ci sono ancora
  // squalifiche ledger attive (altrimenti il mister avrà migrato nel ledger).
  const activeSuspensions = suspensionRows.filter((row) => row.status === "ACTIVE");
  const remainingFromLedger = activeSuspensions.reduce(
    (sum, row) => sum + remainingMatchdays(row),
    0,
  );
  const remaining =
    activeSuspensions.length > 0
      ? remainingFromLedger
      : totalRemainingMatchdays([], totals.openSuspensionMatchdaysFromOpening);

  return {
    opening,
    incidents,
    suspensions,
    totals: {
      ...totals,
      remainingSuspensions: remaining,
    },
  };
}

export async function loadRemainingSuspensionsByAthleteIds(params: {
  athleteIds: string[];
  seasonLabel: string;
  competitionKind: CompetitionKind;
}): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (params.athleteIds.length === 0) return result;

  const [openings, suspensions] = await Promise.all([
    prisma.disciplinaryOpeningBalance.findMany({
      where: {
        athleteId: { in: params.athleteIds },
        seasonLabel: params.seasonLabel,
        competitionKind: params.competitionKind,
      },
      select: {
        athleteId: true,
        openSuspensionMatchdays: true,
      },
    }),
    prisma.disciplinarySuspension.findMany({
      where: {
        athleteId: { in: params.athleteIds },
        seasonLabel: params.seasonLabel,
        competitionKind: params.competitionKind,
        status: "ACTIVE",
      },
      select: {
        athleteId: true,
        matchdaysTotal: true,
        status: true,
        servings: { select: { status: true } },
      },
    }),
  ]);

  const openingByAthlete = new Map(
    openings.map((row) => [row.athleteId, row.openSuspensionMatchdays] as const),
  );
  const suspensionsByAthlete = new Map<string, typeof suspensions>();
  for (const row of suspensions) {
    const list = suspensionsByAthlete.get(row.athleteId) ?? [];
    list.push(row);
    suspensionsByAthlete.set(row.athleteId, list);
  }

  for (const athleteId of params.athleteIds) {
    const list = suspensionsByAthlete.get(athleteId) ?? [];
    if (list.length > 0) {
      result.set(
        athleteId,
        list.reduce(
          (sum, row) =>
            sum +
            remainingMatchdays({
              status: row.status,
              matchdaysTotal: row.matchdaysTotal,
              servings: row.servings,
            }),
          0,
        ),
      );
    } else {
      result.set(athleteId, openingByAthlete.get(athleteId) ?? 0);
    }
  }

  return result;
}
