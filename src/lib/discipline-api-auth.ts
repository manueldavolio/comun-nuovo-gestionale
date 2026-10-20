/**
 * Decisioni di autorizzazione per API disciplina / valutazioni.
 * Pure functions: testabili senza Next.js / Prisma.
 */

export type DisciplineApiAccessResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

const STAFF_ROLES = new Set(["ADMIN", "YOUTH_DIRECTOR", "COACH"]);

export function isDisciplineStaffRole(role: string | null | undefined): boolean {
  return typeof role === "string" && STAFF_ROLES.has(role);
}

/** Gate comune: sessione + ruolo staff + categoria gestibile. */
export function decideDisciplineApiAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  canManageTargetCategory: boolean;
}): DisciplineApiAccessResult {
  if (!input.authenticated) {
    return { ok: false, status: 401, error: "Sessione non valida." };
  }
  if (!isDisciplineStaffRole(input.role)) {
    return { ok: false, status: 403, error: "Operazione non consentita." };
  }
  if (!input.canManageTargetCategory) {
    return { ok: false, status: 403, error: "Operazione non consentita." };
  }
  return { ok: true };
}

/**
 * Valutazioni postpartita: solo staff autorizzato sull'evento/categoria.
 * Genitori e atleti (PARENT) → 403.
 */
export function decideMatchRatingAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  canManageEvent: boolean;
  athleteBelongsToEventCategory: boolean;
}): DisciplineApiAccessResult {
  if (!input.authenticated) {
    return { ok: false, status: 401, error: "Sessione non valida." };
  }
  if (!isDisciplineStaffRole(input.role)) {
    return { ok: false, status: 403, error: "Operazione non consentita." };
  }
  if (!input.canManageEvent) {
    return { ok: false, status: 403, error: "Operazione non consentita." };
  }
  if (!input.athleteBelongsToEventCategory) {
    return { ok: false, status: 403, error: "Operazione non consentita." };
  }
  return { ok: true };
}

/**
 * ADMIN / YOUTH_DIRECTOR: accesso società-wide (canManageCategory = true lato caller).
 * COACH: solo categorie assegnate (canManageCategory risolto da CoachCategoryAssignment).
 */
export function resolveStaffCategoryManageability(input: {
  role: string | null | undefined;
  assignedCategoryIds: string[];
  targetCategoryId: string;
}): boolean {
  if (input.role === "ADMIN" || input.role === "YOUTH_DIRECTOR") {
    return true;
  }
  if (input.role !== "COACH") {
    return false;
  }
  return input.assignedCategoryIds.includes(input.targetCategoryId);
}
