import "server-only";
import type { UserRole } from "@prisma/client";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import {
  decideEventCategoryAccess,
  decideEventCategoryMoveAccess,
  eventCategoryAccessErrorMessage,
  toCategorySectorLookup,
  youthSectorCategoryWhere,
  type CategorySectorLookup,
  type EventCategoryAccessDecision,
} from "@/lib/category-event-access-policy";
import { prisma } from "@/lib/prisma";

export type CategoryEventAccessResult =
  | { ok: true }
  | { ok: false; status: 403 | 404; error: string };

async function resolveSector(categoryId: string | null): Promise<{
  categoryId: string | null;
  sector: CategorySectorLookup;
}> {
  if (!categoryId) {
    return { categoryId: null, sector: null };
  }
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, sector: true },
  });
  if (!category) {
    return { categoryId, sector: "MISSING" };
  }
  return { categoryId: category.id, sector: toCategorySectorLookup(category.sector) };
}

async function coachAssigned(userId: string, categoryId: string | null): Promise<boolean> {
  if (!categoryId) return false;
  const ids = await getCoachCategoryIdsForUser(userId);
  return ids.includes(categoryId);
}

export async function canManageCategoryForEvents(params: {
  userId: string;
  role: UserRole | string;
  categoryId: string;
}): Promise<boolean> {
  const resolved = await resolveSector(params.categoryId);
  const assigned =
    params.role === "COACH" ? await coachAssigned(params.userId, params.categoryId) : false;
  return decideEventCategoryAccess({
    role: params.role,
    categoryId: params.categoryId,
    sector: resolved.sector,
    coachAssignedToCategory: assigned,
  }).allow;
}

export async function assertCanManageCategoryForEvents(params: {
  userId: string;
  role: UserRole | string;
  categoryId: string;
}): Promise<CategoryEventAccessResult> {
  const resolved = await resolveSector(params.categoryId);
  if (resolved.sector === "MISSING") {
    return { ok: false, status: 404, error: "Categoria non trovata." };
  }
  const assigned =
    params.role === "COACH" ? await coachAssigned(params.userId, params.categoryId) : false;
  const decision = decideEventCategoryAccess({
    role: params.role,
    categoryId: params.categoryId,
    sector: resolved.sector,
    coachAssignedToCategory: assigned,
  });
  if (!decision.allow) {
    return { ok: false, status: 403, error: eventCategoryAccessErrorMessage(decision) };
  }
  return { ok: true };
}

export async function canManageEventForStaff(params: {
  userId: string;
  role: UserRole | string;
  eventId: string;
}): Promise<boolean> {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { id: true, categoryId: true },
  });
  if (!event) return false;

  const resolved = await resolveSector(event.categoryId);
  const assigned =
    params.role === "COACH" ? await coachAssigned(params.userId, event.categoryId) : false;
  return decideEventCategoryAccess({
    role: params.role,
    categoryId: event.categoryId,
    sector: resolved.sector,
    coachAssignedToCategory: assigned,
  }).allow;
}

export async function assertCanManageEventForStaff(params: {
  userId: string;
  role: UserRole | string;
  eventId: string;
}): Promise<CategoryEventAccessResult> {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { id: true, categoryId: true },
  });
  if (!event) {
    return { ok: false, status: 404, error: "Evento non trovato." };
  }

  const resolved = await resolveSector(event.categoryId);
  const assigned =
    params.role === "COACH" ? await coachAssigned(params.userId, event.categoryId) : false;
  const decision = decideEventCategoryAccess({
    role: params.role,
    categoryId: event.categoryId,
    sector: resolved.sector,
    coachAssignedToCategory: assigned,
  });
  if (!decision.allow) {
    return { ok: false, status: 403, error: eventCategoryAccessErrorMessage(decision) };
  }
  return { ok: true };
}

export async function assertCanManageEventMoveForStaff(params: {
  userId: string;
  role: UserRole | string;
  eventId: string;
  targetCategoryId: string;
}): Promise<CategoryEventAccessResult> {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { id: true, categoryId: true },
  });
  if (!event) {
    return { ok: false, status: 404, error: "Evento non trovato." };
  }

  const source = await resolveSector(event.categoryId);
  const target = await resolveSector(params.targetCategoryId);
  if (target.sector === "MISSING") {
    return { ok: false, status: 404, error: "Categoria non trovata." };
  }

  let coachAssignedToSource = false;
  let coachAssignedToTarget = false;
  if (params.role === "COACH") {
    const ids = await getCoachCategoryIdsForUser(params.userId);
    coachAssignedToSource = event.categoryId ? ids.includes(event.categoryId) : false;
    coachAssignedToTarget = ids.includes(params.targetCategoryId);
  }

  const decision = decideEventCategoryMoveAccess({
    role: params.role,
    sourceCategoryId: event.categoryId,
    sourceSector: source.sector,
    targetCategoryId: params.targetCategoryId,
    targetSector: target.sector,
    coachAssignedToSource,
    coachAssignedToTarget,
  });
  if (!decision.allow) {
    return { ok: false, status: 403, error: eventCategoryAccessErrorMessage(decision) };
  }
  return { ok: true };
}

/** Category IDs the role may use for event create/edit selectors and calendar filters. */
export async function listManageableCategoryIdsForEvents(params: {
  userId: string;
  role: UserRole | string;
  activeOnly?: boolean;
}): Promise<string[]> {
  const activeOnly = params.activeOnly !== false;

  if (params.role === "ADMIN") {
    const cats = await prisma.category.findMany({
      where: activeOnly ? { isActive: true } : {},
      select: { id: true },
    });
    return cats.map((c) => c.id);
  }

  if (params.role === "YOUTH_DIRECTOR") {
    const cats = await prisma.category.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...youthSectorCategoryWhere(),
      },
      select: { id: true },
    });
    return cats.map((c) => c.id);
  }

  if (params.role === "COACH") {
    return getCoachCategoryIdsForUser(params.userId);
  }

  return [];
}

export function decisionFromPolicy(
  decision: EventCategoryAccessDecision,
): CategoryEventAccessResult {
  if (decision.allow) return { ok: true };
  return { ok: false, status: 403, error: eventCategoryAccessErrorMessage(decision) };
}
