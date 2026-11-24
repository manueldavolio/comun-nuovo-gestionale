import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { decideAreaRoleGate, ROLE_SYNC_PATH } from "@/lib/auth-role-sync";

/**
 * Gate server per layout/pagine area.
 * Ruolo diverso da quello atteso → sync JWT (non /unauthorized), così le
 * promozioni non restano bloccate su cookie stale.
 */
export function requireAreaRole(
  sessionRole: UserRole | string | null | undefined,
  allowedRoles: readonly UserRole[],
  loginCallbackPath: string,
): void {
  const decision = decideAreaRoleGate({ sessionRole, allowedRoles });
  if (decision === "allow") return;
  if (decision === "login") {
    redirect(`/login?callbackUrl=${encodeURIComponent(loginCallbackPath)}`);
  }
  redirect(ROLE_SYNC_PATH);
}
