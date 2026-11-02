"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AthleteConsentRow = {
  id: string;
  firstName: string;
  lastName: string;
  granted: boolean;
};

export function ImageConsentManager({ athletes }: { athletes: AthleteConsentRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function updateConsent(athleteId: string, granted: boolean) {
    setPendingId(athleteId);
    setError(null);
    setOk(null);
    try {
      const response = await fetch(`/api/genitore/athletes/${athleteId}/image-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granted }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Aggiornamento non riuscito.");
        return;
      }
      setOk(granted ? "Autorizzazione immagini aggiornata." : "Autorizzazione immagini revocata.");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setPendingId(null);
    }
  }

  if (athletes.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-black text-zinc-900">Autorizzazione foto e video</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Puoi concedere o revocare l&apos;autorizzazione per ciascun figlio. La revoca nasconde i
        media in cui risulta soggetto identificabile.
      </p>

      <ul className="mt-4 space-y-3">
        {athletes.map((athlete) => (
          <li
            key={athlete.id}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold text-zinc-900">
                {athlete.firstName} {athlete.lastName}
              </p>
              <p className="text-xs text-zinc-500">
                Stato: {athlete.granted ? "autorizzato" : "non autorizzato"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pendingId === athlete.id || athlete.granted}
                onClick={() => updateConsent(athlete.id, true)}
                className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                Autorizza
              </button>
              <button
                type="button"
                disabled={pendingId === athlete.id || !athlete.granted}
                onClick={() => updateConsent(athlete.id, false)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                Revoca
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </p>
      ) : null}
    </section>
  );
}
