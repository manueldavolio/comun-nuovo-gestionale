import type { PredictionChoice } from "@prisma/client";
import { MATCH_EVENT_TYPES } from "@/lib/parent-season";
import { resolveMatchDayOpponentName } from "@/lib/match-day";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";

export const PREDICTION_MATCH_EVENT_TYPES = MATCH_EVENT_TYPES;

export type OfficialPredictionOutcome = "HOME" | "DRAW" | "AWAY" | "PENDING";
export type PickEvaluation = "CORRECT" | "WRONG" | "PENDING";

export type SlipLockState = "OPEN" | "LOCKED";

export function resolveOfficialPredictionOutcome(
  homeScore: number | null | undefined,
  awayScore: number | null | undefined,
): OfficialPredictionOutcome {
  if (homeScore == null || awayScore == null) {
    return "PENDING";
  }
  if (homeScore > awayScore) return "HOME";
  if (homeScore < awayScore) return "AWAY";
  return "DRAW";
}

/** Usato solo al publish (o preview draft): min(closesAt, primo kickoff). */
export function computeEffectiveClosesAt(
  closesAt: Date,
  eventStartAts: Date[],
): Date {
  let effective = closesAt;
  for (const startAt of eventStartAts) {
    if (startAt.getTime() < effective.getTime()) {
      effective = startAt;
    }
  }
  return effective;
}

/**
 * Dopo publish, effectiveClosesAt può solo anticiparsi (mai posticiparsi).
 */
export function advanceEffectiveClosesAtOnlyEarlier(
  currentEffectiveClosesAt: Date,
  nextClosesAt: Date,
): Date {
  return nextClosesAt.getTime() < currentEffectiveClosesAt.getTime()
    ? nextClosesAt
    : currentEffectiveClosesAt;
}

/**
 * Lock su deadline congelata:
 * - lockedAt != null => LOCKED
 * - now >= effectiveClosesAt => LOCKED (+ suggerisce persist lockedAt)
 *
 * Non usa più Event.startAt live.
 */
export function resolveSlipLockState(input: {
  lockedAt: Date | null | undefined;
  effectiveClosesAt: Date;
  now?: Date;
}): { state: SlipLockState; effectiveClosesAt: Date; shouldPersistLockedAt: boolean } {
  const now = input.now ?? nowAsEuropeRomeWallClockUtc();
  const effectiveClosesAt = input.effectiveClosesAt;

  if (input.lockedAt != null) {
    return { state: "LOCKED", effectiveClosesAt, shouldPersistLockedAt: false };
  }

  if (now.getTime() >= effectiveClosesAt.getTime()) {
    return { state: "LOCKED", effectiveClosesAt, shouldPersistLockedAt: true };
  }

  return { state: "OPEN", effectiveClosesAt, shouldPersistLockedAt: false };
}

export function evaluatePredictionPick(input: {
  choice: PredictionChoice | "HOME" | "DRAW" | "AWAY";
  homeScore: number | null | undefined;
  awayScore: number | null | undefined;
}): PickEvaluation {
  const outcome = resolveOfficialPredictionOutcome(input.homeScore, input.awayScore);
  if (outcome === "PENDING") return "PENDING";
  return outcome === input.choice ? "CORRECT" : "WRONG";
}

export type EntryEvaluation = {
  correct: number;
  wrong: number;
  pending: number;
  total: number;
  resolved: number;
  perfect: boolean;
  evaluable: boolean;
};

export function evaluatePredictionEntry(input: {
  slipEventCount: number;
  picks: Array<{
    choice: PredictionChoice | "HOME" | "DRAW" | "AWAY";
    homeScore: number | null | undefined;
    awayScore: number | null | undefined;
  }>;
}): EntryEvaluation {
  const total = input.slipEventCount;
  let correct = 0;
  let wrong = 0;
  let pending = 0;

  for (const pick of input.picks) {
    const result = evaluatePredictionPick(pick);
    if (result === "CORRECT") correct += 1;
    else if (result === "WRONG") wrong += 1;
    else pending += 1;
  }

  const covered = input.picks.length;
  if (covered < total) {
    pending += total - covered;
  }

  const resolved = correct + wrong;
  const evaluable = total > 0 && pending === 0 && covered === total;
  const perfect = evaluable && wrong === 0 && correct === total;

  return {
    correct,
    wrong,
    pending,
    total,
    resolved,
    perfect,
    evaluable,
  };
}

export function isPredictionEventTypeEligible(type: string): boolean {
  return (PREDICTION_MATCH_EVENT_TYPES as readonly string[]).includes(type);
}

export function isOpponentResolvable(input: {
  opponentName: string | null | undefined;
  title: string | null | undefined;
}): boolean {
  const explicit = (input.opponentName ?? "").trim();
  if (explicit.length >= 2) return true;
  const resolved = resolveMatchDayOpponentName(input);
  return resolved.trim().length >= 2 && resolved !== "Avversario";
}

export function isEventEligibleForPredictionSlip(event: {
  type: string;
  startAt: Date | null | undefined;
  isHome: boolean | null | undefined;
  opponentName: string | null | undefined;
  title: string | null | undefined;
}): { ok: true } | { ok: false; reason: string } {
  if (!isPredictionEventTypeEligible(event.type)) {
    return { ok: false, reason: "Tipo evento non ammissibile." };
  }
  if (!event.startAt || Number.isNaN(event.startAt.getTime())) {
    return { ok: false, reason: "Data/ora evento non valida." };
  }
  if (event.isHome == null) {
    return { ok: false, reason: "Casa/trasferta non impostata." };
  }
  if (!isOpponentResolvable(event)) {
    return { ok: false, reason: "Avversario non risolvibile." };
  }
  return { ok: true };
}

export function formatPredictionChoiceLabel(choice: PredictionChoice | OfficialPredictionOutcome): string {
  if (choice === "HOME") return "1";
  if (choice === "AWAY") return "2";
  if (choice === "DRAW") return "X";
  return "—";
}

export function buildMatchSideLabels(input: {
  isHome: boolean;
  opponentName: string;
  clubName?: string;
}): { homeLabel: string; awayLabel: string } {
  const club = (input.clubName ?? "Comun Nuovo").trim() || "Comun Nuovo";
  const opponent = input.opponentName.trim() || "Avversario";
  if (input.isHome) {
    return { homeLabel: club, awayLabel: opponent };
  }
  return { homeLabel: opponent, awayLabel: club };
}

export function validateCompletePicksPayload(input: {
  slipEventIds: string[];
  picks: Array<{ slipEventId: string; choice: string }>;
}): { ok: true; normalized: Array<{ slipEventId: string; choice: PredictionChoice }> } | { ok: false; error: string } {
  const allowed = new Set(input.slipEventIds);
  if (input.picks.length !== input.slipEventIds.length) {
    return { ok: false, error: "Devi pronosticare tutte le partite della schedina." };
  }

  const seen = new Set<string>();
  const normalized: Array<{ slipEventId: string; choice: PredictionChoice }> = [];

  for (const pick of input.picks) {
    const slipEventId = typeof pick.slipEventId === "string" ? pick.slipEventId.trim() : "";
    const choice = typeof pick.choice === "string" ? pick.choice.trim().toUpperCase() : "";

    if (!slipEventId || !allowed.has(slipEventId)) {
      return { ok: false, error: "Pronostico su partita non appartenente alla schedina." };
    }
    if (seen.has(slipEventId)) {
      return { ok: false, error: "Pronostico duplicato sulla stessa partita." };
    }
    if (choice !== "HOME" && choice !== "DRAW" && choice !== "AWAY") {
      return { ok: false, error: "Scelta non valida. Usa 1, X o 2." };
    }

    seen.add(slipEventId);
    normalized.push({ slipEventId, choice });
  }

  for (const id of input.slipEventIds) {
    if (!seen.has(id)) {
      return { ok: false, error: "Devi pronosticare tutte le partite della schedina." };
    }
  }

  return { ok: true, normalized };
}

export const DASHBOARD_SLIP_HISTORY_DAYS = 21;

export function isWithinDashboardHistoryWindow(input: {
  referenceAt: Date;
  now?: Date;
  days?: number;
}): boolean {
  const now = input.now ?? nowAsEuropeRomeWallClockUtc();
  const days = input.days ?? DASHBOARD_SLIP_HISTORY_DAYS;
  const ageMs = now.getTime() - input.referenceAt.getTime();
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

export class PredictionSlipClosedError extends Error {
  readonly status = 409 as const;
  constructor(message = "Schedina chiusa: non è più possibile modificare i pronostici.") {
    super(message);
    this.name = "PredictionSlipClosedError";
  }
}

export class PredictionSlipNotFoundError extends Error {
  readonly status = 404 as const;
  constructor(message = "Schedina non trovata.") {
    super(message);
    this.name = "PredictionSlipNotFoundError";
  }
}

export class PredictionSlipValidationError extends Error {
  readonly status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = "PredictionSlipValidationError";
  }
}
