"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ATHLETE_WITHDRAW_CONFIRM_TOKEN } from "@/lib/athlete-roster-status";

type AthleteWithdrawButtonProps = {
  athleteId: string;
  firstName: string;
  lastName: string;
  hasPaidEvidence: boolean;
};

export function AthleteWithdrawButton({
  athleteId,
  firstName,
  lastName,
  hasPaidEvidence,
}: AthleteWithdrawButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = useMemo(
    () => `${firstName} ${lastName}`.trim(),
    [firstName, lastName],
  );
  const canConfirm = confirmText.trim() === ATHLETE_WITHDRAW_CONFIRM_TOKEN;

  function closeModal() {
    if (pending) return;
    setOpen(false);
    setConfirmText("");
    setReason("");
    setError(null);
  }

  async function onConfirm() {
    if (!canConfirm || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/athletes/${athleteId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmToken: ATHLETE_WITHDRAW_CONFIRM_TOKEN,
          reason: reason.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Ritiro non riuscito.");
        setPending(false);
        return;
      }
      setOpen(false);
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
        onClick={() => {
          setError(null);
          setConfirmText("");
          setReason("");
          setOpen(true);
        }}
        className="inline-flex min-h-11 items-center rounded-lg border border-amber-300 bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
      >
        Ritira atleta
      </button>

      {open ? (
        <div
          className="fixed inset-x-0 top-0 z-50 flex min-h-screen items-center justify-center bg-zinc-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="athlete-withdraw-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-xl">
            <h3 id="athlete-withdraw-title" className="text-lg font-semibold text-zinc-900">
              Conferma ritiro
            </h3>
            <p className="mt-3 text-sm text-zinc-700">
              Stai per ritirare{" "}
              <span className="font-semibold text-zinc-900">{fullName}</span> dalla rosa
              attiva.
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              L&apos;atleta non comparirà più in rose Mister, nuove convocazioni e formazioni.
              Pagamenti, ricevute e movimenti contabili restano conservati.
            </p>
            {hasPaidEvidence ? (
              <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Questo atleta ha evidenze di pagamento: il ritiro è consentito e lo storico
                economico non viene cancellato.
              </p>
            ) : null}
            <label className="mt-4 block text-sm font-medium text-zinc-700">
              Motivo (opzionale)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={300}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Es. trasferimento, scelta famiglia…"
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-zinc-700">
              Digita {ATHLETE_WITHDRAW_CONFIRM_TOKEN} per confermare
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
                autoComplete="off"
              />
            </label>
            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={pending}
                className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-700"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={!canConfirm || pending}
                onClick={() => void onConfirm()}
                className="min-h-11 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Ritiro…" : "Conferma ritiro"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
