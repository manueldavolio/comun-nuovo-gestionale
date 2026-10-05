/**
 * Ruoli atleta canonici per Fanta / Match Center.
 * DB resta String? (niente enum) per non rompere legacy free-text.
 */

export const ATHLETE_ROLE_CODES = ["POR", "DIF", "CEN", "ATT"] as const;

export type AthleteRoleCode = (typeof ATHLETE_ROLE_CODES)[number];

export const ATHLETE_ROLE_LABEL: Record<AthleteRoleCode, string> = {
  POR: "Portiere",
  DIF: "Difensore",
  CEN: "Centrocampista",
  ATT: "Attaccante",
};

export const ATHLETE_ROLE_CHOICES: Array<{ value: AthleteRoleCode; label: string }> =
  ATHLETE_ROLE_CODES.map((value) => ({
    value,
    label: `${value} · ${ATHLETE_ROLE_LABEL[value]}`,
  }));

/** Solo i quattro codici canonici (case-insensitive). Nessuna mappa legacy → codice. */
export function parseCanonicalAthleteRole(
  value: string | null | undefined,
): AthleteRoleCode | null {
  const raw = (value ?? "").trim().toUpperCase();
  if (!raw) return null;
  if ((ATHLETE_ROLE_CODES as readonly string[]).includes(raw)) {
    return raw as AthleteRoleCode;
  }
  return null;
}

export function isCanonicalAthleteRole(value: string | null | undefined): boolean {
  return parseCanonicalAthleteRole(value) != null;
}

export function isGoalkeeperRole(value: string | null | undefined): boolean {
  return parseCanonicalAthleteRole(value) === "POR";
}

export function hasAssignedAthleteRole(value: string | null | undefined): boolean {
  return parseCanonicalAthleteRole(value) != null;
}

/** Etichetta UI: codice canonico, oppure testo legacy, oppure placeholder. */
export function formatAthleteRoleDisplay(value: string | null | undefined): string {
  const code = parseCanonicalAthleteRole(value);
  if (code) return code;
  const legacy = (value ?? "").trim();
  if (legacy) return legacy;
  return "Ruolo da assegnare";
}

/**
 * Normalizza stats match per salvataggio.
 * Assente → goals/assists 0, goalsConceded null.
 * Non-POR → goalsConceded forzato null (solo su scrittura esplicita).
 */
export function normalizeMatchPlayerStatsForSave(input: {
  status: string;
  goals: number;
  assists: number;
  /** undefined = campo non inviato dal client */
  goalsConceded?: number | null;
  isGoalkeeper: boolean;
}): {
  goals: number;
  assists: number;
  goalsConceded: number | null | undefined;
} {
  if (input.status !== "PRESENT") {
    return {
      goals: 0,
      assists: 0,
      goalsConceded: input.goalsConceded === undefined ? undefined : null,
    };
  }

  const goals = Math.max(0, Math.min(99, Math.trunc(input.goals) || 0));
  const assists = Math.max(0, Math.min(99, Math.trunc(input.assists) || 0));

  if (!input.isGoalkeeper) {
    if (input.goalsConceded != null) {
      // Caller/API must reject; here we force null for safety on write path.
      return { goals, assists, goalsConceded: null };
    }
    return {
      goals,
      assists,
      goalsConceded: input.goalsConceded === undefined ? undefined : null,
    };
  }

  if (input.goalsConceded === undefined) {
    return { goals, assists, goalsConceded: undefined };
  }
  if (input.goalsConceded == null) {
    return { goals, assists, goalsConceded: null };
  }
  return {
    goals,
    assists,
    goalsConceded: Math.max(0, Math.min(99, Math.trunc(input.goalsConceded))),
  };
}

/** Decide se persistire MatchPlayerStat (include clean sheet goalsConceded=0). */
export function shouldPersistMatchPlayerStat(input: {
  present: boolean;
  goals: number;
  assists: number;
  goalsConceded: number | null | undefined;
  existingGoalsConceded?: number | null;
}): boolean {
  if (!input.present) return false;
  if (input.goals > 0 || input.assists > 0) return true;
  const conceded =
    input.goalsConceded === undefined
      ? (input.existingGoalsConceded ?? null)
      : input.goalsConceded;
  return conceded != null;
}
