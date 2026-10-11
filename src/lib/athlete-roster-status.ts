/**
 * Ritiro / riattivazione atleta (rosa operativa).
 * NON modifica Payment / Receipt / AccountingEntry.
 */

export const ATHLETE_ROSTER_STATUSES = ["ACTIVE", "WITHDRAWN"] as const;
export type AthleteRosterStatus = (typeof ATHLETE_ROSTER_STATUSES)[number];

export const ATHLETE_WITHDRAW_CONFIRM_TOKEN = "RITIRA";
export const ATHLETE_WITHDRAW_REASON_MAX = 300;

export const ATHLETE_ROSTER_STATUS_LABEL: Record<AthleteRosterStatus, string> = {
  ACTIVE: "Attivo",
  WITHDRAWN: "Ritirato",
};

export type AdminAthleteStatusFilter = "active" | "withdrawn" | "all";

export function isAthleteRosterStatus(value: unknown): value is AthleteRosterStatus {
  return (
    typeof value === "string" &&
    (ATHLETE_ROSTER_STATUSES as readonly string[]).includes(value)
  );
}

export function isAthleteActive(rosterStatus: string | null | undefined): boolean {
  return rosterStatus == null || rosterStatus === "ACTIVE";
}

/** Where Prisma per sole rose attive. */
export function activeAthleteWhere(): { rosterStatus: "ACTIVE" } {
  return { rosterStatus: "ACTIVE" };
}

export function parseAdminAthleteStatusFilter(
  raw: string | null | undefined,
): AdminAthleteStatusFilter {
  const value = (raw ?? "active").trim().toLowerCase();
  if (value === "withdrawn" || value === "ritirati") return "withdrawn";
  if (value === "all" || value === "tutti") return "all";
  return "active";
}

export function rosterStatusWhereForAdminFilter(
  filter: AdminAthleteStatusFilter,
): { rosterStatus?: AthleteRosterStatus } {
  if (filter === "active") return { rosterStatus: "ACTIVE" };
  if (filter === "withdrawn") return { rosterStatus: "WITHDRAWN" };
  return {};
}

export function normalizeWithdrawReason(raw: unknown):
  | { ok: true; reason: string | null }
  | { ok: false; error: string } {
  if (raw == null || raw === "") {
    return { ok: true, reason: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Motivo non valido." };
  }
  const reason = raw.trim().replace(/\s+/g, " ");
  if (!reason) return { ok: true, reason: null };
  if (reason.length > ATHLETE_WITHDRAW_REASON_MAX) {
    return {
      ok: false,
      error: `Motivo troppo lungo (max ${ATHLETE_WITHDRAW_REASON_MAX} caratteri).`,
    };
  }
  return { ok: true, reason };
}

export type WithdrawAthleteInput = {
  rosterStatus: string;
  confirmToken: unknown;
  reason: unknown;
  withdrawnAt: Date;
};

export type WithdrawAthleteDecision =
  | {
      ok: true;
      data: {
        rosterStatus: "WITHDRAWN";
        withdrawnAt: Date;
        withdrawReason: string | null;
      };
    }
  | { ok: false; error: string; status: 400 | 409 };

export function decideWithdrawAthlete(input: WithdrawAthleteInput): WithdrawAthleteDecision {
  if (input.confirmToken !== ATHLETE_WITHDRAW_CONFIRM_TOKEN) {
    return {
      ok: false,
      status: 400,
      error: `Conferma non valida. Digita ${ATHLETE_WITHDRAW_CONFIRM_TOKEN} per procedere.`,
    };
  }
  if (input.rosterStatus === "WITHDRAWN") {
    return { ok: false, status: 409, error: "L'atleta risulta già ritirato." };
  }
  const reasonResult = normalizeWithdrawReason(input.reason);
  if (!reasonResult.ok) {
    return { ok: false, status: 400, error: reasonResult.error };
  }
  return {
    ok: true,
    data: {
      rosterStatus: "WITHDRAWN",
      withdrawnAt: input.withdrawnAt,
      withdrawReason: reasonResult.reason,
    },
  };
}

export type ReactivateAthleteDecision =
  | {
      ok: true;
      data: {
        rosterStatus: "ACTIVE";
        withdrawnAt: null;
        withdrawReason: null;
      };
    }
  | { ok: false; error: string; status: 409 };

export function decideReactivateAthlete(rosterStatus: string): ReactivateAthleteDecision {
  if (rosterStatus !== "WITHDRAWN") {
    return { ok: false, status: 409, error: "L'atleta non risulta ritirato." };
  }
  return {
    ok: true,
    data: {
      rosterStatus: "ACTIVE",
      withdrawnAt: null,
      withdrawReason: null,
    },
  };
}

/**
 * Rose operative: ACTIVE.
 * Storico evento: include anche ritirati già presenti su Attendance dell'evento.
 */
export function rosterAthletesForEventWhere(eventId: string): {
  OR: Array<Record<string, unknown>>;
} {
  return {
    OR: [
      { rosterStatus: "ACTIVE" },
      { attendances: { some: { eventId } } },
    ],
  };
}

/**
 * Convocazione: ACTIVE oppure già selezionati nella convocazione corrente.
 */
export function rosterAthletesForConvocationWhere(selectedAthleteIds: string[]): {
  OR: Array<Record<string, unknown>>;
} {
  if (selectedAthleteIds.length === 0) {
    return { OR: [{ rosterStatus: "ACTIVE" }] };
  }
  return {
    OR: [{ rosterStatus: "ACTIVE" }, { id: { in: selectedAthleteIds } }],
  };
}
