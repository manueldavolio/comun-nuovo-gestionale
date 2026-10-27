/**
 * Pure policy for event/category management by role (E0.1d Fase 2).
 * No Prisma / Next imports — unit-testable.
 */
import {
  canYouthDirectorAccessCategorySector,
  normalizeCategorySector,
  type CategorySector,
} from "@/lib/category-sector";

export type CategorySectorLookup = CategorySector | "MISSING";

export type EventCategoryAccessDecision =
  | { allow: true }
  | { allow: false; code: "FORBIDDEN" | "NO_CATEGORY" | "NOT_YOUTH" | "NOT_ASSIGNED" };

export function toCategorySectorLookup(value: unknown): CategorySectorLookup {
  if (value === "MISSING") return "MISSING";
  return normalizeCategorySector(value);
}

/**
 * Decide if a role may manage events / convocations / attendance for a category.
 * ADMIN: always (including null categoryId).
 * YOUTH_DIRECTOR: only explicit YOUTH sector; null categoryId / null sector / FIRST_TEAM / missing → deny.
 * COACH: assignment required; null categoryId → deny (sector not used).
 */
export function decideEventCategoryAccess(input: {
  role: string | null | undefined;
  categoryId: string | null;
  sector: CategorySectorLookup;
  coachAssignedToCategory: boolean;
}): EventCategoryAccessDecision {
  const role = input.role ?? "";

  if (role === "ADMIN") {
    return { allow: true };
  }

  if (role === "YOUTH_DIRECTOR") {
    if (!input.categoryId) {
      return { allow: false, code: "NO_CATEGORY" };
    }
    if (input.sector === "MISSING") {
      return { allow: false, code: "NOT_YOUTH" };
    }
    if (!canYouthDirectorAccessCategorySector(input.sector)) {
      return { allow: false, code: "NOT_YOUTH" };
    }
    return { allow: true };
  }

  if (role === "COACH") {
    if (!input.categoryId) {
      return { allow: false, code: "NO_CATEGORY" };
    }
    if (!input.coachAssignedToCategory) {
      return { allow: false, code: "NOT_ASSIGNED" };
    }
    return { allow: true };
  }

  return { allow: false, code: "FORBIDDEN" };
}

/** Source + target must both be manageable (PATCH move / reassign). */
export function decideEventCategoryMoveAccess(input: {
  role: string | null | undefined;
  sourceCategoryId: string | null;
  sourceSector: CategorySectorLookup;
  targetCategoryId: string;
  targetSector: CategorySectorLookup;
  coachAssignedToSource: boolean;
  coachAssignedToTarget: boolean;
}): EventCategoryAccessDecision {
  const source = decideEventCategoryAccess({
    role: input.role,
    categoryId: input.sourceCategoryId,
    sector: input.sourceSector,
    coachAssignedToCategory: input.coachAssignedToSource,
  });
  if (!source.allow) return source;

  return decideEventCategoryAccess({
    role: input.role,
    categoryId: input.targetCategoryId,
    sector: input.targetSector,
    coachAssignedToCategory: input.coachAssignedToTarget,
  });
}

export function eventCategoryAccessErrorMessage(
  decision: Extract<EventCategoryAccessDecision, { allow: false }>,
): string {
  switch (decision.code) {
    case "NO_CATEGORY":
      return "Puoi gestire solo eventi collegati a una categoria autorizzata.";
    case "NOT_YOUTH":
      return "Puoi gestire solo eventi del settore giovanile.";
    case "NOT_ASSIGNED":
      return "Puoi gestire solo eventi collegati alle tue categorie.";
    default:
      return "Operazione non consentita.";
  }
}

/** Prisma where fragment: active youth categories only. */
export function youthSectorCategoryWhere() {
  return { sector: "YOUTH" as const };
}
