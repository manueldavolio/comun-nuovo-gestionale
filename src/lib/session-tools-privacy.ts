/**
 * Anti-leak: TrainingSession / MatchFormation mai esposti ai genitori.
 */

export const PARENT_FORBIDDEN_SESSION_TOOL_KEYS = [
  "matchFormation",
  "trainingSession",
  "trainingSessionId",
  "formationId",
  "formation",
  "formationSlots",
  "MatchFormation",
  "MatchFormationSlot",
  "TrainingSession",
  "TrainingSessionItem",
  "TrainingExercise",
  "sessionItems",
] as const;

const FORBIDDEN_SET = new Set<string>(PARENT_FORBIDDEN_SESSION_TOOL_KEYS);

/**
 * Walk nested plain objects/arrays and collect forbidden keys found.
 * Skips Date and non-plain objects.
 */
export function findSessionToolsLeakKeys(
  value: unknown,
  path = "",
  found: string[] = [],
): string[] {
  if (value == null) return found;
  if (typeof value !== "object") return found;
  if (value instanceof Date) return found;
  if (Array.isArray(value)) {
    value.forEach((item, i) => findSessionToolsLeakKeys(item, `${path}[${i}]`, found));
    return found;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_SET.has(key)) {
      found.push(nextPath);
    }
    // Avoid false positives on innocent fields named similarly inside non-event payloads:
    // still flag them — caller should only pass parent event/match payloads.
    findSessionToolsLeakKeys(obj[key], nextPath, found);
  }
  return found;
}

export function assertNoSessionToolsLeak(payload: unknown): void {
  const leaks = findSessionToolsLeakKeys(payload);
  if (leaks.length > 0) {
    throw new Error(`Session tools leak: ${leaks.join(", ")}`);
  }
}

export function parentPayloadHasSessionToolsLeak(payload: unknown): boolean {
  return findSessionToolsLeakKeys(payload).length > 0;
}

/**
 * Chiavi Event consentite nelle select genitore (documentazione + test).
 * Non devono includere trainingSession / matchFormation.
 */
export const PARENT_SAFE_EVENT_SELECT_KEYS = [
  "id",
  "title",
  "description",
  "type",
  "startAt",
  "endAt",
  "location",
  "categoryId",
  "opponentName",
  "homeScore",
  "awayScore",
  "isHome",
  "createdAt",
  "updatedAt",
  "category",
  "attendances",
  "convocation",
  "matchStats",
  "periodScores",
] as const;

export function isParentSafeEventSelect(
  selectKeys: string[],
): { ok: true } | { ok: false; badKeys: string[] } {
  const bad = selectKeys.filter(
    (k) =>
      k === "matchFormation" ||
      k === "trainingSession" ||
      k === "trainingExercises",
  );
  if (bad.length > 0) return { ok: false, badKeys: bad };
  return { ok: true };
}
