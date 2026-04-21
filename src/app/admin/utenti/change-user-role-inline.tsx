"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";

const ROLE_OPTIONS: UserRole[] = ["ADMIN", "YOUTH_DIRECTOR", "COACH", "PARENT"];

const roleLabelMap: Record<UserRole, string> = {
  ADMIN: "Admin",
  YOUTH_DIRECTOR: "Direttore settore giovanile",
  COACH: "Mister",
  PARENT: "Genitore",
};

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
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <select
        aria-label="Cambia ruolo utente"
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs outline-none ring-blue-500 focus:ring-2"
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
        className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending || selectedRole === currentRole}
      >
        {isPending ? "Salvataggio..." : "Cambia ruolo"}
      </button>

      {message ? <span className="text-xs text-zinc-600">{message}</span> : null}
    </div>
  );
}
