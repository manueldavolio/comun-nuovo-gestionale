"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PrivacyAcknowledgementPanelProps = {
  acknowledgedCurrent: boolean;
  currentVersion: string | null;
  latestAcknowledgedAt: string | null;
};

export function PrivacyAcknowledgementPanel({
  acknowledgedCurrent,
  currentVersion,
  latestAcknowledgedAt,
}: PrivacyAcknowledgementPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function confirmAck() {
    if (!checked) {
      setError("Spunta la dichiarazione di presa visione prima di confermare.");
      return;
    }
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const response = await fetch("/api/genitore/privacy-acknowledgement", {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        note?: string;
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "Registrazione non riuscita.");
        return;
      }
      setOk(body?.note ?? "Presa visione registrata.");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-black text-zinc-900">Passo 1 — Informativa privacy</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Presa visione separata dalle autorizzazioni immagini. Non costituisce consenso a foto o
        video.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Stato:{" "}
        {acknowledgedCurrent
          ? `Completato${latestAcknowledgedAt ? ` il ${new Date(latestAcknowledgedAt).toLocaleString("it-IT")}` : ""}${
              currentVersion ? ` · versione ${currentVersion}` : ""
            }`
          : "Non completato"}
      </p>

      {!acknowledgedCurrent ? (
        <>
          <label className="mt-3 flex items-start gap-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            <span>
              Dichiaro di aver preso visione dell&apos;
              <Link href="/privacy" className="underline underline-offset-2 hover:text-blue-900">
                informativa privacy
              </Link>
              {currentVersion ? ` (versione ${currentVersion})` : ""}.
            </span>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={confirmAck}
            className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? "Registrazione..." : "Conferma presa visione"}
          </button>
        </>
      ) : null}

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
