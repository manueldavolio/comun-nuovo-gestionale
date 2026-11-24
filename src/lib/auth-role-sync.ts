import type { UserRole } from "@prisma/client";
import { ROLE_HOME_PATH, canAccessPath } from "@/lib/permissions";

/** Path client che riallinea il JWT cookie dal DB e reindirizza alla home ruolo. */
export const ROLE_SYNC_PATH = "/auth/riallinea-ruolo";

export type RoleSyncDecision =
  | { type: "goto"; path: string }
  | { type: "signout"; callbackUrl: string };

/**
 * Dopo getSession() (che aggiorna il cookie JWT): vai alla home del ruolo DB
 * oppure logout reale se sessione/ruolo assenti (es. utente inattivo).
 */
export function decideRoleSyncFromSession(input: {
  hasSessionUser: boolean;
  sessionRole: UserRole | string | null | undefined;
}): RoleSyncDecision {
  if (!input.hasSessionUser) {
    return { type: "signout", callbackUrl: "/login" };
  }

  const role = input.sessionRole;
  if (typeof role !== "string" || !(role in ROLE_HOME_PATH)) {
    return { type: "signout", callbackUrl: "/login" };
  }

  return { type: "goto", path: ROLE_HOME_PATH[role as UserRole] };
}

export type AreaRoleGateDecision = "allow" | "sync" | "login";

/** Gate area: ruolo DB giusto → allow; altro ruolo valido → sync; assente → login. */
export function decideAreaRoleGate(input: {
  sessionRole: UserRole | string | null | undefined;
  allowedRoles: readonly UserRole[];
}): AreaRoleGateDecision {
  if (typeof input.sessionRole !== "string" || !input.sessionRole) {
    return "login";
  }
  if (input.allowedRoles.includes(input.sessionRole as UserRole)) {
    return "allow";
  }
  return "sync";
}

/**
 * Evita loop: la destinazione post-sync deve essere accessibile al ruolo DB.
 * Se per qualche motivo non lo fosse, forza logout (non unauthorized).
 */
export function assertSafeRoleHome(role: UserRole, path: string): RoleSyncDecision {
  if (!canAccessPath(role, path)) {
    return { type: "signout", callbackUrl: "/login" };
  }
  return { type: "goto", path };
}
