import type { UserRole } from "@prisma/client";
import { ROLE_HOME_PATH, canAccessPath } from "@/lib/permissions";
import { isPublicReceiptsStaticPath } from "@/lib/payments/mark-paid-disabled";

const PROTECTED_PATHS = ["/admin", "/genitore", "/mister", "/social"];
const VALID_ROLES: UserRole[] = [
  "ADMIN",
  "PARENT",
  "COACH",
  "YOUTH_DIRECTOR",
  "SOCIAL_MEDIA_MANAGER",
];

export type MiddlewareAuthDecision =
  | { type: "next" }
  | { type: "redirect"; to: string }
  | { type: "block"; status: 404 };

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function resolveRoleFromToken(tokenRole: unknown): UserRole | undefined {
  if (typeof tokenRole !== "string") return undefined;
  const normalized = tokenRole.toUpperCase();
  return VALID_ROLES.find((candidate) => candidate === normalized);
}

/**
 * Decisione pura del middleware (senza NextRequest).
 * Garantisce: nessun redirect verso un path ancora vietato per lo stesso ruolo
 * (evita loop: la home del ruolo è sempre accessibile da canAccessPath).
 */
export function decideMiddlewareAuth(input: {
  pathname: string;
  tokenRole: unknown;
  hasToken: boolean;
}): MiddlewareAuthDecision {
  // Legacy mark-paid wrote PDFs under public/receipts → /receipts/*.pdf.
  // Block static exposure for every role (including anonymous). Auth download API is untouched.
  if (isPublicReceiptsStaticPath(input.pathname)) {
    return { type: "block", status: 404 };
  }

  const role = resolveRoleFromToken(input.tokenRole);
  const isLoggedIn = Boolean(input.hasToken && role);

  if ((input.pathname === "/login" || input.pathname === "/register") && isLoggedIn && role) {
    return { type: "redirect", to: ROLE_HOME_PATH[role] };
  }

  if (!isProtectedPath(input.pathname)) {
    return { type: "next" };
  }

  if (!isLoggedIn || !role) {
    const loginUrl = `/login?callbackUrl=${encodeURIComponent(input.pathname)}`;
    return { type: "redirect", to: loginUrl };
  }

  if (!canAccessPath(role, input.pathname)) {
    return { type: "redirect", to: ROLE_HOME_PATH[role] };
  }

  return { type: "next" };
}

/** True se un redirect andrebbe in loop (home non accessibile o uguale al path vietato in modo ciclico). */
export function wouldRedirectLoop(role: UserRole, fromPathname: string): boolean {
  if (canAccessPath(role, fromPathname)) return false;
  const home = ROLE_HOME_PATH[role];
  if (home === fromPathname) return true;
  return !canAccessPath(role, home);
}
