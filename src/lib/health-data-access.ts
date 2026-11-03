/**
 * Accesso ai dati sanitari atleti minorenni.
 * Staff: solo ADMIN. Genitori: solo sul proprio figlio (assert parent separati).
 * COACH / YOUTH_DIRECTOR: nessun dato sanitario; solo partecipazione operativa binaria.
 */
import type { AttendanceStatus, UserRole } from "@prisma/client";
import {
  isOperationalStatusType,
  resolveOperationalStatus,
  type OperationalStatusType,
  type ResolvedOperationalStatus,
} from "@/lib/athlete-operational-status";

export const HEALTH_OPERATIONAL_STATUSES = ["INJURED", "ILL"] as const;
export type HealthOperationalStatus = (typeof HEALTH_OPERATIONAL_STATUSES)[number];

export const PARTICIPATION_CAN_LABEL = "Può partecipare";
export const PARTICIPATION_CANNOT_LABEL = "Non può partecipare";

/** Stati che il mister/dirigente può impostare (niente INJURED/ILL). */
export const COACH_WRITABLE_OPERATIONAL_STATUSES = ["AVAILABLE", "ABSENT"] as const;
export type CoachWritableOperationalStatus =
  (typeof COACH_WRITABLE_OPERATIONAL_STATUSES)[number];

export function canStaffAccessAthleteHealthData(
  role: string | null | undefined,
): boolean {
  return role === "ADMIN";
}

export function isHealthOperationalStatus(
  status: string | null | undefined,
): status is HealthOperationalStatus {
  return (
    typeof status === "string" &&
    (HEALTH_OPERATIONAL_STATUSES as readonly string[]).includes(status)
  );
}

export function isCoachWritableOperationalStatus(
  status: unknown,
): status is CoachWritableOperationalStatus {
  return (
    typeof status === "string" &&
    (COACH_WRITABLE_OPERATIONAL_STATUSES as readonly string[]).includes(status)
  );
}

export function decideStaffHealthDataAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
}):
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string } {
  if (!input.authenticated) {
    return { ok: false, status: 401, error: "Sessione non valida." };
  }
  if (!canStaffAccessAthleteHealthData(input.role)) {
    return { ok: false, status: 403, error: "Operazione non consentita." };
  }
  return { ok: true };
}

/**
 * Vista mister/dirigente: solo partecipazione, senza stato sanitario né note.
 * AVAILABLE => può; qualsiasi altro stato attivo => non può.
 */
export function toParticipationView(
  resolved: Pick<ResolvedOperationalStatus, "status" | "validUntil" | "isDefaultAvailable">,
): {
  canParticipate: boolean;
  label: typeof PARTICIPATION_CAN_LABEL | typeof PARTICIPATION_CANNOT_LABEL;
  validUntil: Date | null;
} {
  const canParticipate = resolved.status === "AVAILABLE" || resolved.isDefaultAvailable;
  return {
    canParticipate,
    label: canParticipate ? PARTICIPATION_CAN_LABEL : PARTICIPATION_CANNOT_LABEL,
    validUntil: canParticipate ? null : resolved.validUntil,
  };
}

export function resolveParticipationFromRecord(input: {
  record:
    | {
        status: string;
        note?: string | null;
        validUntil?: Date | null;
      }
    | null
    | undefined;
  wallNow: Date;
}) {
  const resolved = resolveOperationalStatus(input);
  return {
    resolved,
    participation: toParticipationView(resolved),
  };
}

/** Risposta API mister: mai status INJURED/ILL né note. */
export function coachOperationalStatusApiPayload(input: {
  role: UserRole | string;
  resolved: ResolvedOperationalStatus;
}): Record<string, unknown> {
  if (canStaffAccessAthleteHealthData(input.role)) {
    return {
      success: true,
      status: input.resolved.status,
      note: input.resolved.note,
      validUntil: input.resolved.validUntil,
      canParticipate:
        input.resolved.status === "AVAILABLE" || input.resolved.isDefaultAvailable,
    };
  }

  const participation = toParticipationView(input.resolved);
  return {
    success: true,
    canParticipate: participation.canParticipate,
    label: participation.label,
    // Stato operativo non sanitario: AVAILABLE oppure ABSENT (mappato).
    status: participation.canParticipate ? "AVAILABLE" : "ABSENT",
    note: null,
    validUntil: participation.validUntil,
  };
}

export function denyHealthOperationalWriteForNonAdmin(input: {
  role: string | null | undefined;
  status: OperationalStatusType | string;
}): { ok: true } | { ok: false; error: string } {
  if (canStaffAccessAthleteHealthData(input.role)) {
    return { ok: true };
  }
  if (!isCoachWritableOperationalStatus(input.status)) {
    return {
      ok: false,
      error:
        "Puoi impostare solo «Può partecipare» o «Non può partecipare», senza motivazione sanitaria.",
    };
  }
  return { ok: true };
}

export function sanitizeAttendanceStatusForNonAdminHealth(
  status: AttendanceStatus,
  role: string | null | undefined,
): AttendanceStatus {
  if (canStaffAccessAthleteHealthData(role)) return status;
  if (status === "INJURED") return "ABSENT";
  return status;
}

export function assertNonAdminCannotWriteInjuredAttendance(input: {
  role: string | null | undefined;
  status: string;
}): { ok: true } | { ok: false; error: string } {
  if (canStaffAccessAthleteHealthData(input.role)) return { ok: true };
  if (input.status === "INJURED") {
    return {
      ok: false,
      error: "Lo stato «Infortunato» non è disponibile. Usa Assente o Assenza giustificata.",
    };
  }
  return { ok: true };
}

export function isHealthArchiveDocumentType(type: string | null | undefined): boolean {
  return type === "MEDICAL_CERTIFICATE";
}

/** Helper test/API: elenco path sanitari tipici negati a COACH. */
export const COACH_DENIED_HEALTH_API_PATHS = [
  "/api/admin/medical-visits",
  "/api/admin/medical-visits/upload-certificate",
  "/api/admin/medical-visits/reminders",
] as const;

export function decideCoachDirectHealthApiAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
}): { ok: false; status: 401 | 403; error: string } {
  if (!input.authenticated) {
    return { ok: false, status: 401, error: "Sessione non valida." };
  }
  return { ok: false, status: 403, error: "Operazione non consentita." };
}

export function normalizeOperationalStatusForCoachWrite(
  status: unknown,
): CoachWritableOperationalStatus | null {
  if (!isCoachWritableOperationalStatus(status)) return null;
  return status;
}

export function isOperationalStatusTypeSafe(value: unknown): value is OperationalStatusType {
  return isOperationalStatusType(value);
}
