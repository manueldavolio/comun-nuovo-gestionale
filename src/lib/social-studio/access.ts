import { canUseSocialStudio } from "@/lib/permissions";

export function decideSocialStudioAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
}): { ok: true } | { ok: false; status: 401 | 403 } {
  if (!input.authenticated) return { ok: false, status: 401 };
  if (!canUseSocialStudio(input.role)) return { ok: false, status: 403 };
  return { ok: true };
}
