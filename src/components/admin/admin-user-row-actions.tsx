"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { roleLabelMap } from "@/lib/staff";

const USER_ROLE_OPTIONS: UserRole[] = ["ADMIN", "YOUTH_DIRECTOR", "COACH", "PARENT"];

type AdminUserRowActionsProps = {
  userId: string;
  initialRole: UserRole;
  initialIsActive: boolean;
  isCurrentUser: boolean;
};

export function AdminUserRowActions({
  userId,
  initialRole,
  initialIsActive,
  isCurrentUser,
}: AdminUserRowActionsProps) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(initialRole);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const hasChanges = role !== initialRole || isActive !== initialIsActive;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges) return;

    setError(null);
    setOk(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          isActive,
        }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Aggiornamento non riuscito.");
        return;
      }

      setOk("Aggiornato");
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex min-w-[16rem] flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          disabled={isSubmitting || isCurrentUser}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs outline-none ring-blue-500 focus:ring-2 disabled:opacity-60"
        >
          {USER_ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {roleLabelMap[option]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!hasChanges || isSubmitting}
          className="rounded-md bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "..." : "Salva"}
        </button>
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          disabled={isSubmitting || isCurrentUser}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-700 focus:ring-blue-600"
        />
        Attivo
      </label>

      {isCurrentUser ? <p className="text-[11px] text-zinc-500">Il tuo utente non e modificabile.</p> : null}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
      {ok ? <p className="text-[11px] text-emerald-700">{ok}</p> : null}
    </form>
  );
}
