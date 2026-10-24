import type { UserRole } from "@prisma/client";

export const ROLE_HOME_PATH: Record<UserRole, string> = {
  ADMIN: "/admin",
  PARENT: "/genitore",
  COACH: "/mister",
  YOUTH_DIRECTOR: "/admin",
  SOCIAL_MEDIA_MANAGER: "/social/calendario",
};

export const ROLE_PROTECTED_PREFIXES: Record<UserRole, string[]> = {
  ADMIN: ["/admin", "/mister", "/social"],
  PARENT: ["/genitore"],
  COACH: ["/mister"],
  YOUTH_DIRECTOR: ["/admin"],
  SOCIAL_MEDIA_MANAGER: ["/social"],
};

/** Calendario social + Social Studio (non apre admin/finanze/utenti). */
export function canUseSocialStudio(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SOCIAL_MEDIA_MANAGER";
}

export const ROLE_LABEL_IT: Record<UserRole, string> = {
  ADMIN: "Admin",
  PARENT: "Genitore",
  COACH: "Mister",
  YOUTH_DIRECTOR: "Direttore settore giovanile",
  SOCIAL_MEDIA_MANAGER: "Social Media Manager",
};

/** Ruoli assegnabili da admin nella pagina Utenti (non staff tecnico). */
export const ADMIN_ASSIGNABLE_ROLES: UserRole[] = [
  "ADMIN",
  "YOUTH_DIRECTOR",
  "COACH",
  "PARENT",
  "SOCIAL_MEDIA_MANAGER",
];

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const allowedPrefixes = ROLE_PROTECTED_PREFIXES[role] ?? [];
  return allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
