/**
 * E0.1e — server-side Youth Director asserts for athlete-linked data.
 * Pure policy lives in youth-director-data-access-policy.ts
 */
import "server-only";
import type { UserRole } from "@prisma/client";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import { prisma } from "@/lib/prisma";
import {
  youthDirectorDataAccessErrorMessage,
} from "@/lib/youth-director-data-access-policy";

export {
  athleteListWhereForAdminRole,
  canAdminOrYouthDirectorAccessRole,
  categoryListWhereForAdminRole,
  decideYouthDirectorAnnouncementCreate,
  decideYouthDirectorAthleteCategoryMove,
  decideYouthDirectorCategoryDataAccess,
  youthDirectorAnnouncementWhere,
  youthDirectorAthleteWhere,
  youthDirectorCategoryWhere,
  youthDirectorDataAccessErrorMessage,
  youthDirectorDocumentWhere,
  youthDirectorMediaItemWhere,
  youthDirectorMedicalVisitWhere,
  youthDirectorParentLinkRequestWhere,
  youthDirectorParentUserWhere,
} from "@/lib/youth-director-data-access-policy";

export async function assertCanAccessAthleteData(options: {
  userId: string;
  role: UserRole;
  athleteId: string;
}): Promise<
  | { ok: true; categoryId: string }
  | { ok: false; status: 403 | 404; error: string }
> {
  const categoryId = await getAthleteCategoryId(options.athleteId);
  if (!categoryId) {
    return { ok: false, status: 404, error: "Atleta non trovato." };
  }

  if (options.role === "ADMIN") {
    return { ok: true, categoryId };
  }

  if (options.role !== "YOUTH_DIRECTOR") {
    return { ok: false, status: 403, error: "Operazione non consentita." };
  }

  const allowed = await canManageAthleteCategory({
    userId: options.userId,
    role: options.role,
    categoryId,
  });

  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: youthDirectorDataAccessErrorMessage({ allow: false, code: "NOT_YOUTH" }),
    };
  }

  return { ok: true, categoryId };
}

export async function assertCanAccessMedicalVisitData(options: {
  userId: string;
  role: UserRole;
  medicalVisitId: string;
}): Promise<
  | { ok: true; athleteId: string; categoryId: string }
  | { ok: false; status: 403 | 404; error: string }
> {
  const visit = await prisma.medicalVisit.findUnique({
    where: { id: options.medicalVisitId },
    select: { athleteId: true },
  });
  if (!visit) {
    return { ok: false, status: 404, error: "Visita medica non trovata." };
  }
  const athleteAccess = await assertCanAccessAthleteData({
    userId: options.userId,
    role: options.role,
    athleteId: visit.athleteId,
  });
  if (!athleteAccess.ok) {
    return athleteAccess;
  }
  return { ok: true, athleteId: visit.athleteId, categoryId: athleteAccess.categoryId };
}

export async function assertCanAccessArchiveDocumentData(options: {
  userId: string;
  role: UserRole;
  documentId: string;
}): Promise<
  | { ok: true; athleteId: string; categoryId: string }
  | { ok: false; status: 403 | 404; error: string }
> {
  const doc = await prisma.document.findUnique({
    where: { id: options.documentId },
    select: { athleteId: true },
  });
  if (!doc) {
    return { ok: false, status: 404, error: "Documento non trovato." };
  }
  const athleteAccess = await assertCanAccessAthleteData({
    userId: options.userId,
    role: options.role,
    athleteId: doc.athleteId,
  });
  if (!athleteAccess.ok) {
    return athleteAccess;
  }
  return { ok: true, athleteId: doc.athleteId, categoryId: athleteAccess.categoryId };
}

export async function assertCanAccessEnrollmentDocumentData(options: {
  userId: string;
  role: UserRole;
  documentId: string;
}): Promise<
  | { ok: true; athleteId: string; categoryId: string }
  | { ok: false; status: 403 | 404; error: string }
> {
  const doc = await prisma.enrollmentDocument.findUnique({
    where: { id: options.documentId },
    select: {
      enrollment: {
        select: { athleteId: true },
      },
    },
  });
  if (!doc?.enrollment?.athleteId) {
    return { ok: false, status: 404, error: "Documento non trovato." };
  }
  const athleteAccess = await assertCanAccessAthleteData({
    userId: options.userId,
    role: options.role,
    athleteId: doc.enrollment.athleteId,
  });
  if (!athleteAccess.ok) {
    return athleteAccess;
  }
  return {
    ok: true,
    athleteId: doc.enrollment.athleteId,
    categoryId: athleteAccess.categoryId,
  };
}

export async function assertCanAccessParentAthleteLinkRequest(options: {
  userId: string;
  role: UserRole;
  requestId: string;
}): Promise<
  | { ok: true; athleteId: string; categoryId: string }
  | { ok: false; status: 403 | 404; error: string }
> {
  const request = await prisma.parentAthleteLinkRequest.findUnique({
    where: { id: options.requestId },
    select: { athleteId: true },
  });
  if (!request) {
    return { ok: false, status: 404, error: "Richiesta non trovata." };
  }
  const athleteAccess = await assertCanAccessAthleteData({
    userId: options.userId,
    role: options.role,
    athleteId: request.athleteId,
  });
  if (!athleteAccess.ok) {
    return athleteAccess;
  }
  return {
    ok: true,
    athleteId: request.athleteId,
    categoryId: athleteAccess.categoryId,
  };
}

export async function assertCanAccessCategoryData(options: {
  userId: string;
  role: UserRole;
  categoryId: string;
}): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  if (options.role === "ADMIN") {
    const exists = await prisma.category.findUnique({
      where: { id: options.categoryId },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false, status: 404, error: "Categoria non trovata." };
    }
    return { ok: true };
  }

  if (options.role !== "YOUTH_DIRECTOR") {
    return { ok: false, status: 403, error: "Operazione non consentita." };
  }

  const allowed = await canManageAthleteCategory({
    userId: options.userId,
    role: options.role,
    categoryId: options.categoryId,
  });
  if (!allowed) {
    const exists = await prisma.category.findUnique({
      where: { id: options.categoryId },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false, status: 404, error: "Categoria non trovata." };
    }
    return {
      ok: false,
      status: 403,
      error: youthDirectorDataAccessErrorMessage({ allow: false, code: "NOT_YOUTH" }),
    };
  }
  return { ok: true };
}
