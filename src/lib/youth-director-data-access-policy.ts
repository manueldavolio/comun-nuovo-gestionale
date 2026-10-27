/**
 * E0.1e — pure Youth Director data-scope policy (no Prisma / server-only).
 */
import type { Prisma } from "@prisma/client";
import {
  decideEventCategoryAccess,
  decideEventCategoryMoveAccess,
  youthSectorCategoryWhere,
  type CategorySectorLookup,
  type EventCategoryAccessDecision,
} from "@/lib/category-event-access-policy";

export type YouthDirectorDataAccessDecision = EventCategoryAccessDecision;

export function decideYouthDirectorCategoryDataAccess(input: {
  role: string | null | undefined;
  categoryId: string | null;
  sector: CategorySectorLookup;
}): YouthDirectorDataAccessDecision {
  return decideEventCategoryAccess({
    role: input.role,
    categoryId: input.categoryId,
    sector: input.sector,
    coachAssignedToCategory: false,
  });
}

/** Pure: YD may move only YOUTH → YOUTH; ADMIN always; others forbidden here. */
export function decideYouthDirectorAthleteCategoryMove(input: {
  role: string | null | undefined;
  sourceCategoryId: string | null;
  sourceSector: CategorySectorLookup;
  targetCategoryId: string;
  targetSector: CategorySectorLookup;
}): YouthDirectorDataAccessDecision {
  if (input.role === "ADMIN") {
    return { allow: true };
  }
  if (input.role !== "YOUTH_DIRECTOR") {
    return { allow: false, code: "FORBIDDEN" };
  }
  return decideEventCategoryMoveAccess({
    role: "YOUTH_DIRECTOR",
    sourceCategoryId: input.sourceCategoryId,
    sourceSector: input.sourceSector,
    targetCategoryId: input.targetCategoryId,
    targetSector: input.targetSector,
    coachAssignedToSource: false,
    coachAssignedToTarget: false,
  });
}

export function youthDirectorDataAccessErrorMessage(
  decision: Extract<YouthDirectorDataAccessDecision, { allow: false }>,
): string {
  switch (decision.code) {
    case "NO_CATEGORY":
      return "Puoi gestire solo dati collegati a una categoria autorizzata.";
    case "NOT_YOUTH":
      return "Puoi gestire solo dati del settore giovanile.";
    case "NOT_ASSIGNED":
      return "Operazione non consentita.";
    default:
      return "Operazione non consentita.";
  }
}

export function youthDirectorAthleteWhere(): Prisma.AthleteWhereInput {
  return {
    category: youthSectorCategoryWhere(),
  };
}

export function youthDirectorDocumentWhere(): Prisma.DocumentWhereInput {
  return {
    athlete: youthDirectorAthleteWhere(),
  };
}

export function youthDirectorMedicalVisitWhere(): Prisma.MedicalVisitWhereInput {
  return {
    athlete: youthDirectorAthleteWhere(),
  };
}

export function youthDirectorCategoryWhere(activeOnly = true): Prisma.CategoryWhereInput {
  return {
    ...(activeOnly ? { isActive: true } : {}),
    ...youthSectorCategoryWhere(),
  };
}

/**
 * Announcements visible/manageable by YD:
 * only rows with an explicit YOUTH categoryId (society-wide excluded).
 */
export function youthDirectorAnnouncementWhere(): Prisma.AnnouncementWhereInput {
  return {
    categoryId: { not: null },
    category: youthSectorCategoryWhere(),
  };
}

export function youthDirectorMediaItemWhere(): Prisma.MediaItemWhereInput {
  return {
    category: youthSectorCategoryWhere(),
  };
}

export function canAdminOrYouthDirectorAccessRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "YOUTH_DIRECTOR";
}

/**
 * YD may only create CATEGORY_ONLY announcements for an explicit YOUTH category.
 */
export function decideYouthDirectorAnnouncementCreate(input: {
  role: string | null | undefined;
  audience: string;
  categoryId: string | null;
  sector: CategorySectorLookup;
}): YouthDirectorDataAccessDecision {
  if (input.role === "ADMIN") {
    return { allow: true };
  }
  if (input.role !== "YOUTH_DIRECTOR") {
    return { allow: false, code: "FORBIDDEN" };
  }
  if (input.audience !== "CATEGORY_ONLY") {
    return { allow: false, code: "FORBIDDEN" };
  }
  return decideYouthDirectorCategoryDataAccess({
    role: "YOUTH_DIRECTOR",
    categoryId: input.categoryId,
    sector: input.sector,
  });
}

export function athleteListWhereForAdminRole(
  role: string | null | undefined,
): Prisma.AthleteWhereInput | null {
  if (role === "ADMIN") return {};
  if (role === "YOUTH_DIRECTOR") return youthDirectorAthleteWhere();
  return null;
}

export function categoryListWhereForAdminRole(
  role: string | null | undefined,
  activeOnly = true,
): Prisma.CategoryWhereInput | null {
  if (role === "ADMIN") return activeOnly ? { isActive: true } : {};
  if (role === "YOUTH_DIRECTOR") return youthDirectorCategoryWhere(activeOnly);
  return null;
}

export function youthDirectorParentUserWhere(): Prisma.UserWhereInput {
  return {
    role: "PARENT",
    parentProfile: {
      OR: [
        { athletes: { some: youthDirectorAthleteWhere() } },
        {
          additionalAthleteLinks: {
            some: { athlete: youthDirectorAthleteWhere() },
          },
        },
      ],
    },
  };
}

export function youthDirectorParentLinkRequestWhere(): Prisma.ParentAthleteLinkRequestWhereInput {
  return {
    athlete: youthDirectorAthleteWhere(),
  };
}
