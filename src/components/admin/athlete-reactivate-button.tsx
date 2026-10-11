"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AthleteReactivateButtonProps = {
  athleteId: string;
  firstName: string;
  lastName: string;
};

export function AthleteReactivateButton({
  athleteId,
  firstName,
  lastName,
}: AthleteReactivateButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onReactivate() {
    if (pending) return;
    const ok = window.confirm(
      `Riattivare ${firstName} ${lastName} nella rosa attiva?`,
    );
    if (!ok) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/athletes/${athleteId}/reactivate`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Riattivazione non riuscita.");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => void onReactivate()}
        className="inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? "Riattivazione…" : "Riattiva atleta"}
      </button>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
