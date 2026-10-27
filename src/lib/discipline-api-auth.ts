/**
 * Decisioni di autorizzazione per API disciplina / valutazioni.
 * Pure functions: testabili senza Next.js / Prisma.
 */
import {
  decideEventCategoryAccess,
  toCategorySectorLookup,
  type CategorySectorLookup,
} from "@/lib/category-event-access-policy";
import type { CategorySector } from "@/lib/category-sector";

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
 * ADMIN: qualsiasi categoria.
 * YOUTH_DIRECTOR: solo sector YOUTH (fail-closed se sector assente/null/FIRST_TEAM).
 * COACH: solo categorie in assignedCategoryIds.
 */
export function resolveStaffCategoryManageability(input: {
  role: string | null | undefined;
  assignedCategoryIds: string[];
  targetCategoryId: string;
  /**
   * Settore della categoria target. Obbligatorio per YD (fail-closed):
   * se omesso → trattato come MISSING → deny.
   */
  targetSector?: CategorySector | CategorySectorLookup | null;
}): boolean {
  if (input.role === "ADMIN") {
    return true;
  }

  if (input.role === "YOUTH_DIRECTOR") {
    const sector: CategorySectorLookup =
      input.targetSector === undefined
        ? "MISSING"
        : input.targetSector === "MISSING"
          ? "MISSING"
          : toCategorySectorLookup(input.targetSector);
    return decideEventCategoryAccess({
      role: "YOUTH_DIRECTOR",
      categoryId: input.targetCategoryId,
      sector,
      coachAssignedToCategory: false,
    }).allow;
  }

  if (input.role !== "COACH") {
    return false;
  }
  return input.assignedCategoryIds.includes(input.targetCategoryId);
}
