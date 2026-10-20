import type {
  CompetitionKind,
  DisciplinarySanctionType,
  SuspensionServeStatus,
} from "@prisma/client";
import { currentSeasonRange } from "@/lib/parent-season";

export const DISCIPLINARY_SANCTION_TYPES = [
  "YELLOW_CARD",
  "RED_CARD",
  "SECOND_YELLOW_RED",
  "DIRECT_SUSPENSION",
  "OTHER",
] as const;

export const DISCIPLINARY_SANCTION_LABEL: Record<DisciplinarySanctionType, string> = {
  YELLOW_CARD: "Ammonizione",
  RED_CARD: "Espulsione diretta",
  SECOND_YELLOW_RED: "Espulsione (doppia ammonizione)",
  DIRECT_SUSPENSION: "Squalifica diretta",
  OTHER: "Altro provvedimento",
};

export function seasonLabelFromDate(now = new Date()): string {
  const season = currentSeasonRange(now);
  const startYear = season.start.getUTCFullYear();
  return `${startYear}/${startYear + 1}`;
}

export function isDisciplinarySanctionType(
  value: unknown,
): value is DisciplinarySanctionType {
  return (
    typeof value === "string" &&
    (DISCIPLINARY_SANCTION_TYPES as readonly string[]).includes(value)
  );
}

export function yellowContribution(type: DisciplinarySanctionType): number {
  if (type === "YELLOW_CARD") return 1;
  if (type === "SECOND_YELLOW_RED") return 2;
  return 0;
}

export function redContribution(type: DisciplinarySanctionType): number {
  if (type === "RED_CARD" || type === "SECOND_YELLOW_RED") return 1;
  return 0;
}

export type OpeningBalanceInput = {
  priorYellowCards: number;
  priorYellowCardsForAccumulation: number;
  priorRedCards: number;
  openSuspensionMatchdays: number;
  referenceDate: Date;
};

export type IncidentForTotals = {
  type: DisciplinarySanctionType;
  status: "ACTIVE" | "VOIDED";
  eventStartAt: Date | null;
  createdAt: Date;
};

/**
 * Esclude incidenti su gare con data <= referenceDate dell'apertura,
 * per evitare doppio conteggio con il pregresso.
 */
export function incidentCountsTowardTotals(params: {
  incident: IncidentForTotals;
  openingReferenceDate: Date | null;
}): boolean {
  if (params.incident.status !== "ACTIVE") return false;
  if (!params.openingReferenceDate) return true;
  const eventAt = params.incident.eventStartAt ?? params.incident.createdAt;
  return eventAt.getTime() > params.openingReferenceDate.getTime();
}

export type DisciplineTotals = {
  yellowCards: number;
  yellowCardsForAccumulation: number;
  redCards: number;
  openSuspensionMatchdaysFromOpening: number;
};

export function computeDisciplineTotals(params: {
  opening: OpeningBalanceInput | null;
  incidents: IncidentForTotals[];
}): DisciplineTotals {
  const opening = params.opening;
  let yellow = opening?.priorYellowCards ?? 0;
  let yellowAcc = opening?.priorYellowCardsForAccumulation ?? 0;
  let red = opening?.priorRedCards ?? 0;
  const ref = opening?.referenceDate ?? null;

  for (const incident of params.incidents) {
    if (!incidentCountsTowardTotals({ incident, openingReferenceDate: ref })) {
      continue;
    }
    const y = yellowContribution(incident.type);
    const r = redContribution(incident.type);
    yellow += y;
    yellowAcc += y;
    red += r;
  }

  return {
    yellowCards: yellow,
    yellowCardsForAccumulation: yellowAcc,
    redCards: red,
    openSuspensionMatchdaysFromOpening: opening?.openSuspensionMatchdays ?? 0,
  };
}

export type SuspensionForRemaining = {
  status: "ACTIVE" | "VOIDED";
  matchdaysTotal: number;
  servings: Array<{ status: SuspensionServeStatus }>;
};

export function servedMatchdaysCount(
  servings: Array<{ status: SuspensionServeStatus }>,
): number {
  return servings.filter((row) => row.status === "SERVED").length;
}

export function remainingMatchdays(suspension: SuspensionForRemaining): number {
  if (suspension.status !== "ACTIVE") return 0;
  return Math.max(0, suspension.matchdaysTotal - servedMatchdaysCount(suspension.servings));
}

export function totalRemainingMatchdays(
  suspensions: SuspensionForRemaining[],
  openingOpenMatchdays = 0,
): number {
  const fromLedger = suspensions.reduce(
    (sum, row) => sum + remainingMatchdays(row),
    0,
  );
  return fromLedger + Math.max(0, openingOpenMatchdays);
}

export function normalizeNonNegativeInt(
  value: unknown,
  max = 99,
): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return { ok: false, error: "Valore non valido (intero ≥ 0)." };
  }
  if (value > max) {
    return { ok: false, error: `Valore troppo alto (max ${max}).` };
  }
  return { ok: true, value };
}

export function normalizeOptionalMinute(
  value: unknown,
): { ok: true; minute: number | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, minute: null };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 130) {
    return { ok: false, error: "Minuto non valido (0–130)." };
  }
  return { ok: true, minute: value };
}

export function normalizeOptionalNotes(
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

export type UpsertOpeningDecision =
  | {
      ok: true;
      data: {
        priorYellowCards: number;
        priorYellowCardsForAccumulation: number;
        priorRedCards: number;
        openSuspensionMatchdays: number;
        referenceDate: Date;
        notes: string | null;
        seasonLabel: string;
        competitionKind: CompetitionKind;
      };
    }
  | { ok: false; error: string; status: 400 };

export function decideUpsertOpeningBalance(input: {
  seasonLabel: unknown;
  competitionKind: CompetitionKind;
  priorYellowCards: unknown;
  priorYellowCardsForAccumulation: unknown;
  priorRedCards: unknown;
  openSuspensionMatchdays: unknown;
  referenceDate: Date;
  notes: unknown;
}): UpsertOpeningDecision {
  if (typeof input.seasonLabel !== "string" || !input.seasonLabel.trim()) {
    return { ok: false, status: 400, error: "Stagione non valida." };
  }
  const yellow = normalizeNonNegativeInt(input.priorYellowCards);
  if (!yellow.ok) return { ok: false, status: 400, error: yellow.error };
  const yellowAcc = normalizeNonNegativeInt(input.priorYellowCardsForAccumulation);
  if (!yellowAcc.ok) return { ok: false, status: 400, error: yellowAcc.error };
  const red = normalizeNonNegativeInt(input.priorRedCards);
  if (!red.ok) return { ok: false, status: 400, error: red.error };
  const open = normalizeNonNegativeInt(input.openSuspensionMatchdays, 30);
  if (!open.ok) return { ok: false, status: 400, error: open.error };
  if (yellowAcc.value > yellow.value) {
    return {
      ok: false,
      status: 400,
      error: "Le ammonizioni per accumulo non possono superare il totale storico.",
    };
  }
  const notes = normalizeOptionalNotes(input.notes);
  if (!notes.ok) return { ok: false, status: 400, error: notes.error };

  return {
    ok: true,
    data: {
      priorYellowCards: yellow.value,
      priorYellowCardsForAccumulation: yellowAcc.value,
      priorRedCards: red.value,
      openSuspensionMatchdays: open.value,
      referenceDate: input.referenceDate,
      notes: notes.notes,
      seasonLabel: input.seasonLabel.trim(),
      competitionKind: input.competitionKind,
    },
  };
}

export type CreateSuspensionDecision =
  | {
      ok: true;
      data: {
        matchdaysTotal: number;
        officialRef: string | null;
        decidedAt: Date | null;
        notes: string | null;
        servingsToCreate: number;
      };
    }
  | { ok: false; error: string; status: 400 };

export function decideCreateSuspension(input: {
  matchdaysTotal: unknown;
  officialRef: unknown;
  decidedAt: Date | null;
  notes: unknown;
}): CreateSuspensionDecision {
  const total = normalizeNonNegativeInt(input.matchdaysTotal, 30);
  if (!total.ok) return { ok: false, status: 400, error: total.error };
  if (total.value < 1) {
    return { ok: false, status: 400, error: "Indicare almeno 1 giornata." };
  }
  let officialRef: string | null = null;
  if (input.officialRef != null && input.officialRef !== "") {
    if (typeof input.officialRef !== "string") {
      return { ok: false, status: 400, error: "Riferimento comunicato non valido." };
    }
    officialRef = input.officialRef.trim().replace(/\s+/g, " ") || null;
    if (officialRef && officialRef.length > 120) {
      return { ok: false, status: 400, error: "Riferimento troppo lungo (max 120)." };
    }
  }
  const notes = normalizeOptionalNotes(input.notes);
  if (!notes.ok) return { ok: false, status: 400, error: notes.error };

  return {
    ok: true,
    data: {
      matchdaysTotal: total.value,
      officialRef,
      decidedAt: input.decidedAt,
      notes: notes.notes,
      servingsToCreate: total.value,
    },
  };
}
