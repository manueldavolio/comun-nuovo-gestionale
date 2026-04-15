import type { Role } from "@/generated/prisma/enums";

export const ROLE_HOME_PATH: Record<Role, string> = {
  ADMIN: "/admin",
  PARENT: "/genitore",
  COACH: "/mister",
  YOUTH_DIRECTOR: "/admin",
};

export const ROLE_PROTECTED_PREFIXES: Record<Role, string[]> = {
  ADMIN: ["/admin"],
  PARENT: ["/genitore"],
  COACH: ["/mister"],
  YOUTH_DIRECTOR: ["/admin"],
};

export function canAccessPath(role: Role, pathname: string): boolean {
  const allowedPrefixes = ROLE_PROTECTED_PREFIXES[role] ?? [];
  return allowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
