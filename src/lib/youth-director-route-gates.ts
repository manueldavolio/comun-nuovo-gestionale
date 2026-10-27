/**
 * E0.1e — pure route-gate contracts for admin/mister athlete-linked APIs.
 * Mirrors server decisions without Next.js / Prisma / storage side effects.
 */
import {
  decideYouthDirectorAnnouncementCreate,
  decideYouthDirectorAthleteCategoryMove,
  decideYouthDirectorCategoryDataAccess,
  youthDirectorDataAccessErrorMessage,
} from "@/lib/youth-director-data-access-policy";
import type { CategorySectorLookup } from "@/lib/category-event-access-policy";

export type RouteGateResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404; error: string; write: false };

function deny(
  status: 401 | 403 | 404,
  error: string,
): Extract<RouteGateResult, { ok: false }> {
  return { ok: false, status, error, write: false };
}

/** Shared: anonymous must be rejected before any protected write. */
export function decideAuthenticatedAdminOrYouthDirector(input: {
  authenticated: boolean;
  role: string | null | undefined;
}): RouteGateResult {
  if (!input.authenticated) {
    return deny(401, "Sessione non valida.");
  }
  if (input.role !== "ADMIN" && input.role !== "YOUTH_DIRECTOR") {
    return deny(403, "Operazione non consentita.");
  }
  return { ok: true };
}

/** Admin-only athlete mutations: delete / withdraw / reactivate / category change. */
export function decideAdminOnlyAthleteMutation(input: {
  authenticated: boolean;
  role: string | null | undefined;
}): RouteGateResult {
  if (!input.authenticated) {
    return deny(401, "Sessione non valida.");
  }
  if (input.role !== "ADMIN") {
    return deny(403, "Operazione non consentita.");
  }
  return { ok: true };
}

/**
 * Athlete-scoped admin data (medical visit, archive document, enrollment download).
 * athleteExists false → 404; sector via categorySectorLookup.
 */
export function decideAthleteScopedAdminDataAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  athleteExists: boolean;
  categoryId: string | null;
  categorySector: CategorySectorLookup;
}): RouteGateResult {
  const auth = decideAuthenticatedAdminOrYouthDirector(input);
  if (!auth.ok) return auth;

  if (!input.athleteExists) {
    return deny(404, "Atleta non trovato.");
  }

  if (input.role === "ADMIN") {
    return { ok: true };
  }

  const decision = decideYouthDirectorCategoryDataAccess({
    role: input.role,
    categoryId: input.categoryId,
    sector: input.categorySector,
  });
  if (!decision.allow) {
    return deny(403, youthDirectorDataAccessErrorMessage(decision));
  }
  return { ok: true };
}

/** Medical visit / document by resource id → resolve athlete then same gate. */
export function decideResourceOwnedByAthleteAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  resourceExists: boolean;
  athleteExists: boolean;
  categoryId: string | null;
  categorySector: CategorySectorLookup;
}): RouteGateResult {
  const auth = decideAuthenticatedAdminOrYouthDirector(input);
  if (!auth.ok) return auth;
  if (!input.resourceExists) {
    return deny(404, "Risorsa non trovata.");
  }
  return decideAthleteScopedAdminDataAccess({
    authenticated: true,
    role: input.role,
    athleteExists: input.athleteExists,
    categoryId: input.categoryId,
    categorySector: input.categorySector,
  });
}

/**
 * Certificate upload: requires athleteId; deny before storage write.
 * missingAthleteId → 400-equivalent mapped as 403 write:false for gate clarity;
 * callers use 400 in the real route.
 */
export function decideMedicalCertificateUploadAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  athleteId: string | null;
  athleteExists: boolean;
  categoryId: string | null;
  categorySector: CategorySectorLookup;
}): RouteGateResult | { ok: false; status: 400; error: string; write: false } {
  const auth = decideAuthenticatedAdminOrYouthDirector(input);
  if (!auth.ok) return auth;

  if (!input.athleteId) {
    return {
      ok: false,
      status: 400,
      error: "Atleta obbligatorio per caricare un certificato.",
      write: false,
    };
  }

  return decideAthleteScopedAdminDataAccess({
    authenticated: true,
    role: input.role,
    athleteExists: input.athleteExists,
    categoryId: input.categoryId,
    categorySector: input.categorySector,
  });
}

export function decideAnnouncementCreateAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  audience: string;
  categoryId: string | null;
  categorySector: CategorySectorLookup;
}): RouteGateResult {
  const auth = decideAuthenticatedAdminOrYouthDirector(input);
  if (!auth.ok) return auth;

  const decision = decideYouthDirectorAnnouncementCreate({
    role: input.role,
    audience: input.audience,
    categoryId: input.categoryId,
    sector: input.categorySector,
  });
  if (!decision.allow) {
    return deny(
      403,
      input.role === "YOUTH_DIRECTOR"
        ? "Puoi pubblicare solo comunicazioni CATEGORY_ONLY del settore giovanile."
        : youthDirectorDataAccessErrorMessage(decision),
    );
  }
  return { ok: true };
}

export function decideAnnouncementDeleteAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  announcementExists: boolean;
  categoryId: string | null;
  categorySector: CategorySectorLookup;
}): RouteGateResult {
  if (!input.authenticated) {
    return deny(401, "Sessione non valida.");
  }
  if (input.role !== "ADMIN" && input.role !== "YOUTH_DIRECTOR" && input.role !== "COACH") {
    return deny(403, "Operazione non consentita.");
  }
  if (!input.announcementExists) {
    return deny(404, "Comunicazione non trovata.");
  }
  if (input.role === "ADMIN") {
    return { ok: true };
  }
  if (input.role === "YOUTH_DIRECTOR") {
    if (!input.categoryId) {
      return deny(403, "Puoi eliminare solo comunicazioni del settore giovanile.");
    }
    const decision = decideYouthDirectorCategoryDataAccess({
      role: "YOUTH_DIRECTOR",
      categoryId: input.categoryId,
      sector: input.categorySector,
    });
    if (!decision.allow) {
      return deny(403, youthDirectorDataAccessErrorMessage(decision));
    }
    return { ok: true };
  }
  // COACH: assignment checked elsewhere; sector not used.
  return { ok: true };
}

export function decideMediaCreateAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  categoryId: string;
  categoryExists: boolean;
  categorySector: CategorySectorLookup;
  coachAssignedToCategory: boolean;
}): RouteGateResult {
  if (!input.authenticated) {
    return deny(401, "Sessione non valida.");
  }
  if (input.role !== "ADMIN" && input.role !== "YOUTH_DIRECTOR" && input.role !== "COACH") {
    return deny(403, "Operazione non consentita.");
  }
  if (!input.categoryExists) {
    return deny(404, "Categoria non trovata.");
  }
  if (input.role === "ADMIN") {
    return { ok: true };
  }
  if (input.role === "YOUTH_DIRECTOR") {
    const decision = decideYouthDirectorCategoryDataAccess({
      role: "YOUTH_DIRECTOR",
      categoryId: input.categoryId,
      sector: input.categorySector,
    });
    if (!decision.allow) {
      return deny(403, youthDirectorDataAccessErrorMessage(decision));
    }
    return { ok: true };
  }
  if (!input.coachAssignedToCategory) {
    return deny(403, "Puoi creare media solo per categorie assegnate al tuo profilo.");
  }
  return { ok: true };
}

export function decideParentLinkRequestAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  requestExists: boolean;
  athleteExists: boolean;
  categoryId: string | null;
  categorySector: CategorySectorLookup;
}): RouteGateResult {
  const auth = decideAuthenticatedAdminOrYouthDirector(input);
  if (!auth.ok) return auth;
  if (!input.requestExists) {
    return deny(404, "Richiesta non trovata.");
  }
  return decideAthleteScopedAdminDataAccess({
    authenticated: true,
    role: input.role,
    athleteExists: input.athleteExists,
    categoryId: input.categoryId,
    categorySector: input.categorySector,
  });
}

/** Mister athlete PATCH/goals/notes: staff + canManageAthleteCategory equivalent. */
export function decideMisterAthleteMutationAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  athleteExists: boolean;
  categoryId: string | null;
  categorySector: CategorySectorLookup;
  coachAssignedToCategory: boolean;
}): RouteGateResult {
  if (!input.authenticated) {
    return deny(401, "Sessione non valida.");
  }
  if (input.role !== "ADMIN" && input.role !== "YOUTH_DIRECTOR" && input.role !== "COACH") {
    return deny(403, "Operazione non consentita.");
  }
  if (!input.athleteExists || !input.categoryId) {
    return deny(404, "Atleta non trovato.");
  }
  if (input.role === "ADMIN") {
    return { ok: true };
  }
  if (input.role === "YOUTH_DIRECTOR") {
    const decision = decideYouthDirectorCategoryDataAccess({
      role: "YOUTH_DIRECTOR",
      categoryId: input.categoryId,
      sector: input.categorySector,
    });
    if (!decision.allow) {
      return deny(403, "Non puoi modificare questo atleta.");
    }
    return { ok: true };
  }
  if (!input.coachAssignedToCategory) {
    return deny(403, "Non puoi modificare questo atleta.");
  }
  return { ok: true };
}

export function decideAthleteCategoryMoveApiAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
  sourceCategoryId: string | null;
  sourceSector: CategorySectorLookup;
  targetCategoryId: string;
  targetSector: CategorySectorLookup;
}): RouteGateResult {
  // Route is ADMIN-only today; keep explicit for regression.
  const adminOnly = decideAdminOnlyAthleteMutation(input);
  if (!adminOnly.ok) return adminOnly;

  const move = decideYouthDirectorAthleteCategoryMove({
    role: input.role,
    sourceCategoryId: input.sourceCategoryId,
    sourceSector: input.sourceSector,
    targetCategoryId: input.targetCategoryId,
    targetSector: input.targetSector,
  });
  if (!move.allow) {
    return deny(403, youthDirectorDataAccessErrorMessage(move));
  }
  return { ok: true };
}

/** Ensures denied gates never imply a write. */
export function gateAllowsWrite(result: { ok: boolean; write?: false }): boolean {
  return result.ok === true;
}
