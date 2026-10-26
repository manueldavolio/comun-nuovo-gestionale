"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { ADMIN_ASSIGNABLE_ROLES, ROLE_LABEL_IT } from "@/lib/permissions";

const ROLE_OPTIONS = ADMIN_ASSIGNABLE_ROLES;
const roleLabelMap = ROLE_LABEL_IT;

type ChangeUserRoleInlineProps = {
  userId: string;
  currentRole: UserRole;
};

export function ChangeUserRoleInline({ userId, currentRole }: ChangeUserRoleInlineProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  async function handleRoleChange() {
    setMessage("");

    if (!userId || !selectedRole) {
      setMessage("Dati utente non disponibili.");
      return;
    }

    try {
      const response = await fetch("/api/admin/users/role", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          role: selectedRole,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage(payload?.error ?? "Aggiornamento non riuscito.");
        return;
      }

      setMessage("Ruolo aggiornato.");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setMessage("Errore di rete. Riprova.");
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        aria-label="Cambia ruolo utente"
        className="min-h-10 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
        value={selectedRole}
        onChange={(event) => {
          setSelectedRole(event.target.value as UserRole);
          setMessage("");
        }}
        disabled={isPending}
      >
        {ROLE_OPTIONS.map((role) => (
          <option key={role} value={role}>
            {roleLabelMap[role]}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleRoleChange}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || selectedRole === currentRole}
      >
        {isPending ? "Salvataggio..." : "Cambia ruolo"}
      </button>

      {message ? <span className="text-xs font-medium text-zinc-600">{message}</span> : null}
    </div>
  );
}
