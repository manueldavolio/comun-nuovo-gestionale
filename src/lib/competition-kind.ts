import type { CompetitionKind, EventType } from "@prisma/client";

export const COMPETITION_KINDS = [
  "LEAGUE",
  "CUP",
  "TOURNAMENT",
  "FRIENDLY",
  "OTHER",
] as const;

/** Tipi evento che ammettono selezione competizione in UI. */
export const MATCH_TYPES_WITH_COMPETITION = [
  "LEAGUE_MATCH",
  "FRIENDLY",
  "TOURNAMENT",
] as const;

export const COMPETITION_KIND_LABEL: Record<CompetitionKind, string> = {
  LEAGUE: "Campionato",
  CUP: "Coppa",
  TOURNAMENT: "Torneo",
  FRIENDLY: "Amichevole",
  OTHER: "Altro",
};

export function isCompetitionKind(value: unknown): value is CompetitionKind {
  return (
    typeof value === "string" &&
    (COMPETITION_KINDS as readonly string[]).includes(value)
  );
}

/** Default da EventType (backfill / create). TRAINING → null. */
export function defaultCompetitionKindFromEventType(
  type: EventType | string,
): CompetitionKind | null {
  switch (type) {
    case "LEAGUE_MATCH":
      return "LEAGUE";
    case "TOURNAMENT":
      return "TOURNAMENT";
    case "FRIENDLY":
      return "FRIENDLY";
    default:
      return null;
  }
}

export function defaultCountsForDiscipline(
  kind: CompetitionKind | null | undefined,
): boolean {
  return kind === "LEAGUE" || kind === "CUP" || kind === "TOURNAMENT";
}

/** Una squalifica si può scontare solo su gare dello stesso ambito, salvo override esplicito. */
export function canServeSuspensionOnEvent(params: {
  suspensionKind: CompetitionKind;
  eventKind: CompetitionKind | null | undefined;
  eventCountsForDiscipline: boolean;
  allowCrossCompetition?: boolean;
}): boolean {
  if (!params.eventCountsForDiscipline) return false;
  if (!params.eventKind) return false;
  if (params.allowCrossCompetition) return true;
  return params.suspensionKind === params.eventKind;
}

/**
 * Risolve campi competitivi per create/update Event.
 * Compatibile con eventi legacy: se competitionKind assente → default da EventType.
 */
export function resolveEventCompetitionFields(input: {
  type: EventType | string;
  competitionKind?: CompetitionKind | null;
  seasonLabel?: string | null;
  categorySeasonLabel?: string | null;
}): {
  competitionKind: CompetitionKind | null;
  seasonLabel: string | null;
  countsForDiscipline: boolean;
} {
  const isTraining = input.type === "TRAINING";
  const kind = isTraining
    ? null
    : (input.competitionKind ?? defaultCompetitionKindFromEventType(input.type));
  const seasonLabel =
    (input.seasonLabel && input.seasonLabel.trim()) ||
    (input.categorySeasonLabel && input.categorySeasonLabel.trim()) ||
    null;

  return {
    competitionKind: kind,
    seasonLabel,
    countsForDiscipline: isTraining ? false : defaultCountsForDiscipline(kind),
  };
}

export function resolveEventCompetitionFieldsForLegacyEvent(input: {
  type: EventType | string;
  storedCompetitionKind?: CompetitionKind | null;
}): CompetitionKind | null {
  if (input.storedCompetitionKind) return input.storedCompetitionKind;
  return defaultCompetitionKindFromEventType(input.type);
}
