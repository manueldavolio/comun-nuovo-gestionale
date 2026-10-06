export const ACTIVE_PERSONAL_GOAL_STATUSES = ["IN_PROGRESS", "CONTINUE"] as const;
export const MAX_ACTIVE_PERSONAL_GOALS = 3;
export const PERSONAL_GOAL_TEXT_MAX = 200;
export const PERSONAL_GOAL_STATUSES = ["IN_PROGRESS", "ACHIEVED", "CONTINUE"] as const;

export type PersonalGoalStatus = (typeof PERSONAL_GOAL_STATUSES)[number];

export function isPersonalGoalStatus(value: unknown): value is PersonalGoalStatus {
  return (
    typeof value === "string" &&
    (PERSONAL_GOAL_STATUSES as readonly string[]).includes(value)
  );
}

export function isActivePersonalGoalStatus(status: PersonalGoalStatus): boolean {
  return (ACTIVE_PERSONAL_GOAL_STATUSES as readonly string[]).includes(status);
}

export function countActivePersonalGoals(
  goals: Array<{ status: PersonalGoalStatus }>,
): number {
  return goals.filter((goal) => isActivePersonalGoalStatus(goal.status)).length;
}

export function canAddActivePersonalGoal(activeCount: number): boolean {
  return activeCount < MAX_ACTIVE_PERSONAL_GOALS;
}

/**
 * Valida creazione/aggiornamento lato server.
 * `existingActiveCount` = attivi già in DB (escluso il goal che si sta aggiornando).
 * `nextStatus` = stato risultante dopo l'operazione.
 */
export function validatePersonalGoalActiveLimit(input: {
  existingActiveCount: number;
  nextStatus: PersonalGoalStatus;
}): { ok: true } | { ok: false; error: string } {
  if (!isActivePersonalGoalStatus(input.nextStatus)) {
    return { ok: true };
  }
  if (input.existingActiveCount >= MAX_ACTIVE_PERSONAL_GOALS) {
    return {
      ok: false,
      error: `Massimo ${MAX_ACTIVE_PERSONAL_GOALS} obiettivi attivi (In corso / In crescita).`,
    };
  }
  return { ok: true };
}

export function normalizePersonalGoalText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length === 0) return null;
  if (text.length > PERSONAL_GOAL_TEXT_MAX) return null;
  return text;
}

export function personalGoalStatusLabel(status: PersonalGoalStatus): string {
  switch (status) {
    case "IN_PROGRESS":
      return "In corso";
    case "CONTINUE":
      return "In crescita";
    case "ACHIEVED":
      return "Raggiunto ✓";
    default:
      return status;
  }
}

export function personalGoalStatusTone(
  status: PersonalGoalStatus,
): "sky" | "amber" | "emerald" {
  switch (status) {
    case "IN_PROGRESS":
      return "sky";
    case "CONTINUE":
      return "amber";
    case "ACHIEVED":
      return "emerald";
    default:
      return "sky";
  }
}
