import type { CompetitionKind, EventType } from "@prisma/client";
import { resolveEventCompetitionFields } from "@/lib/competition-kind";
import { isMissingDisciplineSchemaError } from "@/lib/discipline-db";
import { prisma } from "@/lib/prisma";

type CompetitionPersistFields = {
  competitionKind: CompetitionKind | null;
  seasonLabel: string | null;
  countsForDiscipline: boolean;
};

export function buildCompetitionPersistFields(input: {
  type: EventType;
  competitionKind?: CompetitionKind | null;
  categorySeasonLabel?: string | null;
}): CompetitionPersistFields {
  return resolveEventCompetitionFields({
    type: input.type,
    competitionKind: input.competitionKind,
    categorySeasonLabel: input.categorySeasonLabel,
  });
}

type BaseEventCreate = {
  title: string;
  type: EventType;
  startAt: Date;
  location: string | null;
  description: string | null;
  categoryId: string;
  createdById: string;
};

/** Create con fallback se colonne disciplina non ancora migrate. */
export async function createEventCompatible(params: {
  base: BaseEventCreate;
  competition: CompetitionPersistFields;
  select: { id: true; categoryId: true };
}) {
  try {
    return await prisma.event.create({
      data: {
        ...params.base,
        competitionKind: params.competition.competitionKind,
        seasonLabel: params.competition.seasonLabel,
        countsForDiscipline: params.competition.countsForDiscipline,
      },
      select: params.select,
    });
  } catch (error) {
    if (!isMissingDisciplineSchemaError(error)) throw error;
    return prisma.event.create({
      data: params.base,
      select: params.select,
    });
  }
}

type BaseEventUpdate = {
  title: string;
  type: EventType;
  startAt: Date;
  location: string | null;
  description: string | null;
  categoryId: string;
};

/** Update con fallback se colonne disciplina non ancora migrate. */
export async function updateEventCompatible(params: {
  eventId: string;
  base: BaseEventUpdate;
  competition: CompetitionPersistFields;
}) {
  try {
    await prisma.event.update({
      where: { id: params.eventId },
      data: {
        ...params.base,
        competitionKind: params.competition.competitionKind,
        seasonLabel: params.competition.seasonLabel,
        countsForDiscipline: params.competition.countsForDiscipline,
      },
    });
  } catch (error) {
    if (!isMissingDisciplineSchemaError(error)) throw error;
    await prisma.event.update({
      where: { id: params.eventId },
      data: params.base,
    });
  }
}
