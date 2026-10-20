import type { UserRole } from "@prisma/client";

export type JwtRoleToken = {
  sub?: string;
  email?: string | null;
  role?: UserRole | string;
};

export type JwtRoleUserSnapshot = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

/**
 * Aggiorna il ruolo JWT da uno snapshot DB.
 * - utente assente/inattivo → rimuove il ruolo (forza re-login sulle pagine protette)
 * - snapshot null (es. DB irraggiungibile) → mantiene il token invariato
 */
export function applyJwtRoleFromDb(
  token: JwtRoleToken,
  userFromDb: JwtRoleUserSnapshot | null | undefined,
  options?: { dbUnreachable?: boolean },
): JwtRoleToken {
  if (options?.dbUnreachable) {
    return token;
  }

  if (!userFromDb || !userFromDb.isActive) {
    const next = { ...token };
    delete next.role;
    return next;
  }

  return {
    ...token,
    sub: userFromDb.id,
    email: userFromDb.email,
    role: userFromDb.role,
  };
}

/** Home path attesa per ruolo (allineata a ROLE_HOME_PATH). */
export function expectedHomeForRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
    case "YOUTH_DIRECTOR":
      return "/admin";
    case "COACH":
      return "/mister";
    case "PARENT":
      return "/genitore";
    default:
      return "/login";
  }
}
