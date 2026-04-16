import type { UserRole } from "@prisma/client";

export const ROLE_HOME_PATH: Record<UserRole, string> = {
  ADMIN: "/admin",
  PARENT: "/genitore",
  COACH: "/mister",
  YOUTH_DIRECTOR: "/admin",
};

export const ROLE_PROTECTED_PREFIXES: Record<UserRole, string[]> = {
  ADMIN: ["/admin", "/mister"],
  PARENT: ["/genitore"],
  COACH: ["/mister"],
  YOUTH_DIRECTOR: ["/admin"],
};

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const allowedPrefixes = ROLE_PROTECTED_PREFIXES[role] ?? [];
  return allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
