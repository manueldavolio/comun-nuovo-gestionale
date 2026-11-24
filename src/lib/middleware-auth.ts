import type { UserRole } from "@prisma/client";
import { ROLE_SYNC_PATH } from "@/lib/auth-role-sync";
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
 * Dopo promozione il cookie può essere stale: login e path non consentiti
 * vanno a ROLE_SYNC_PATH (riallinea JWT) invece della sola home da cookie.
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

  // Pagina di sync: sempre raggiungibile (client aggiorna cookie / fa signOut).
  if (
    input.pathname === ROLE_SYNC_PATH ||
    input.pathname.startsWith(`${ROLE_SYNC_PATH}/`)
  ) {
    return { type: "next" };
  }

  const role = resolveRoleFromToken(input.tokenRole);
  const isLoggedIn = Boolean(input.hasToken && role);

  if ((input.pathname === "/login" || input.pathname === "/register") && isLoggedIn && role) {
    return { type: "redirect", to: ROLE_SYNC_PATH };
  }

  if (!isProtectedPath(input.pathname)) {
    return { type: "next" };
  }

  if (!isLoggedIn || !role) {
    const loginUrl = `/login?callbackUrl=${encodeURIComponent(input.pathname)}`;
    return { type: "redirect", to: loginUrl };
  }

  if (!canAccessPath(role, input.pathname)) {
    // Cookie stale (es. PARENT dopo promozione a COACH): sync prima della home.
    return { type: "redirect", to: ROLE_SYNC_PATH };
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
