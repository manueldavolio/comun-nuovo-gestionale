import type { MedicalVisitStatus } from "@/generated/prisma/enums";

export type ExpiryBadgeStatus = "VALID" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY";

const MS_PER_DAY = 86400000;

function toUTCStartOfDayMs(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function computeMedicalVisitStatus(expiryDate: Date, now: Date = new Date()): MedicalVisitStatus {
  const expiryMs = toUTCStartOfDayMs(expiryDate);
  const nowMs = toUTCStartOfDayMs(now);
  const diffDays = (expiryMs - nowMs) / MS_PER_DAY;

  if (diffDays < 0) return "EXPIRED";
  if (diffDays < 30) return "EXPIRING";
  return "VALID";
}

/**
 * Stato usato per le notifiche ai genitori/societa:
 * - EXPIRING: visita con scadenza "entro 30 giorni" inclusi (diffDays <= 30)
 * - EXPIRED: visita già scaduta (diffDays < 0)
 *
 * Nota: non sostituiamo `computeMedicalVisitStatus` per non rompere la UI esistente.
 */
export function computeMedicalVisitStatusForReminder(
  expiryDate: Date,
  now: Date = new Date(),
): MedicalVisitStatus {
  const expiryMs = toUTCStartOfDayMs(expiryDate);
  const nowMs = toUTCStartOfDayMs(now);
  const diffDays = (expiryMs - nowMs) / MS_PER_DAY;

  if (diffDays < 0) return "EXPIRED";
  if (diffDays <= 30) return "EXPIRING";
  return "VALID";
}

export function computeExpiryBadgeStatus(expiryDate: Date | null, now: Date = new Date()): ExpiryBadgeStatus {
  if (!expiryDate) return "NO_EXPIRY";
  return computeMedicalVisitStatus(expiryDate, now);
}

export const MEDICAL_VISIT_STATUS_LABEL: Record<MedicalVisitStatus, string> = {
  VALID: "Valida",
  EXPIRING: "In scadenza",
  EXPIRED: "Scaduta",
};

export const EXPIRY_BADGE_LABEL: Record<ExpiryBadgeStatus, string> = {
  VALID: MEDICAL_VISIT_STATUS_LABEL.VALID,
  EXPIRING: MEDICAL_VISIT_STATUS_LABEL.EXPIRING,
  EXPIRED: MEDICAL_VISIT_STATUS_LABEL.EXPIRED,
  NO_EXPIRY: "Senza scadenza",
};

export const EXPIRY_BADGE_CLASSES: Record<ExpiryBadgeStatus, string> = {
  VALID: "border-emerald-200 bg-emerald-50 text-emerald-800",
  EXPIRING: "border-amber-200 bg-amber-50 text-amber-800",
  EXPIRED: "border-red-200 bg-red-50 text-red-700",
  NO_EXPIRY: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

