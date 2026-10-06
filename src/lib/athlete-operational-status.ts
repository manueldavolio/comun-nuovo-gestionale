import { parseDateInputToUTC, toDateInputValueUTC } from "@/lib/date-input";
import { wallClockDayBounds } from "@/lib/match-day";

export const OPERATIONAL_STATUS_TYPES = [
  "AVAILABLE",
  "TO_CHECK",
  "INJURED",
  "ILL",
  "ABSENT",
] as const;

export type OperationalStatusType = (typeof OPERATIONAL_STATUS_TYPES)[number];

export const OPERATIONAL_STATUS_NOTE_MAX = 160;

export const OPERATIONAL_STATUS_LABEL: Record<OperationalStatusType, string> = {
  AVAILABLE: "Disponibile",
  TO_CHECK: "Da verificare",
  INJURED: "Infortunato",
  ILL: "Malato",
  ABSENT: "Assente",
};

export const UNAVAILABLE_OPERATIONAL_STATUSES = ["INJURED", "ILL", "ABSENT"] as const;

export function isOperationalStatusType(value: unknown): value is OperationalStatusType {
  return (
    typeof value === "string" &&
    (OPERATIONAL_STATUS_TYPES as readonly string[]).includes(value)
  );
}

export function isUnavailableOperationalStatus(status: OperationalStatusType): boolean {
  return (UNAVAILABLE_OPERATIONAL_STATUSES as readonly string[]).includes(status);
}

export function normalizeOperationalNote(raw: unknown): {
  ok: true;
  note: string | null;
} | { ok: false; error: string } {
  if (raw == null || raw === "") {
    return { ok: true, note: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Nota non valida." };
  }
  const note = raw.trim().replace(/\s+/g, " ");
  if (note.length === 0) {
    return { ok: true, note: null };
  }
  if (note.length > OPERATIONAL_STATUS_NOTE_MAX) {
    return {
      ok: false,
      error: `Nota troppo lunga (max ${OPERATIONAL_STATUS_NOTE_MAX} caratteri).`,
    };
  }
  return { ok: true, note };
}

/** Fine giornata Europe/Rome wall-clock (UTC fields) per una data YYYY-MM-DD. */
export function endOfWallClockDayFromDateInput(dateInput: string): Date | null {
  const start = parseDateInputToUTC(dateInput);
  if (!start) return null;
  return wallClockDayBounds(start).end;
}

export function endOfWallClockDayFromWallNow(wallNow: Date, dayOffset = 0): Date {
  const shifted = new Date(
    Date.UTC(
      wallNow.getUTCFullYear(),
      wallNow.getUTCMonth(),
      wallNow.getUTCDate() + dayOffset,
      12,
      0,
      0,
      0,
    ),
  );
  return wallClockDayBounds(shifted).end;
}

export function isOperationalStatusExpired(
  validUntil: Date | null | undefined,
  wallNow: Date,
): boolean {
  if (!validUntil) return false;
  return wallNow.getTime() > validUntil.getTime();
}

export type ResolvedOperationalStatus = {
  status: OperationalStatusType;
  note: string | null;
  validUntil: Date | null;
  /** True se non esiste record o record scaduto (effective AVAILABLE). */
  isDefaultAvailable: boolean;
  /** True se esiste record non scaduto. */
  hasActiveRecord: boolean;
};

/**
 * Nessuna riga o scaduta => AVAILABLE.
 * Non modifica il DB in lettura.
 */
export function resolveOperationalStatus(input: {
  record:
    | {
        status: string;
        note?: string | null;
        validUntil?: Date | null;
      }
    | null
    | undefined;
  wallNow: Date;
}): ResolvedOperationalStatus {
  const record = input.record;
  if (!record || !isOperationalStatusType(record.status)) {
    return {
      status: "AVAILABLE",
      note: null,
      validUntil: null,
      isDefaultAvailable: true,
      hasActiveRecord: false,
    };
  }

  if (isOperationalStatusExpired(record.validUntil ?? null, input.wallNow)) {
    return {
      status: "AVAILABLE",
      note: null,
      validUntil: null,
      isDefaultAvailable: true,
      hasActiveRecord: false,
    };
  }

  // AVAILABLE persistito non dovrebbe esistere (preferiamo delete), ma se c'è:
  if (record.status === "AVAILABLE") {
    return {
      status: "AVAILABLE",
      note: null,
      validUntil: null,
      isDefaultAvailable: true,
      hasActiveRecord: false,
    };
  }

  return {
    status: record.status,
    note: (record.note ?? "").trim() || null,
    validUntil: record.validUntil ?? null,
    isDefaultAvailable: false,
    hasActiveRecord: true,
  };
}

export type AvailabilitySummary = {
  total: number;
  available: number;
  toCheck: number;
  unavailable: number;
};

export function summarizeAvailability(
  resolved: Array<{ status: OperationalStatusType }>,
): AvailabilitySummary {
  const summary: AvailabilitySummary = {
    total: resolved.length,
    available: 0,
    toCheck: 0,
    unavailable: 0,
  };
  for (const row of resolved) {
    if (row.status === "AVAILABLE") summary.available += 1;
    else if (row.status === "TO_CHECK") summary.toCheck += 1;
    else summary.unavailable += 1;
  }
  return summary;
}

export function operationalStatusPillClass(status: OperationalStatusType): string {
  switch (status) {
    case "AVAILABLE":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "TO_CHECK":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "INJURED":
      return "border-red-200 bg-red-50 text-red-800";
    case "ILL":
      return "border-orange-200 bg-orange-50 text-orange-900";
    case "ABSENT":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

export function validUntilDateInputValue(validUntil: Date | null | undefined): string {
  if (!validUntil) return "";
  return toDateInputValueUTC(validUntil);
}
