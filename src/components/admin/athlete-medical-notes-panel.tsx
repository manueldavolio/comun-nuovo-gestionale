"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN } from "@/lib/athlete-medical-notes";

type AthleteMedicalNotesPanelProps = {
  athleteId: string;
  medicalNotes: string | null;
};

export function AthleteMedicalNotesPanel({
  athleteId,
  medicalNotes,
}: AthleteMedicalNotesPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const hasNotes = Boolean(medicalNotes?.trim());
  const canConfirm = confirmText.trim() === ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN;

  async function onClear() {
    if (!canConfirm || pending) return;
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const response = await fetch(`/api/admin/athletes/${athleteId}/medical-notes/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; note?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita.");
        return;
      }
      setOk(body?.note ?? "Note mediche svuotate.");
      setOpen(false);
      setConfirmText("");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-black text-amber-950">Note mediche storiche (iscrizione)</h2>
      <p className="mt-1 text-sm text-amber-900/80">
        Solo amministrazione. Le nuove iscrizioni non acquisiscono più questo campo. Non
        condividere con allenatori o direttori settore giovanile.
      </p>

      {hasNotes ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm text-zinc-800 whitespace-pre-wrap">
          {medicalNotes}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">Nessuna nota medica storica presente.</p>
      )}

      {ok ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </p>
      ) : null}
      {error && !open ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {hasNotes ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setConfirmText("");
            setError(null);
            setOk(null);
          }}
          className="mt-3 rounded-lg border border-amber-300 bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
        >
          Svuota note storiche…
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-medical-notes-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-xl">
            <h3 id="clear-medical-notes-title" className="text-lg font-semibold text-zinc-900">
              Conferma svuotamento note
            </h3>
            <p className="mt-3 text-sm text-zinc-700">
              Le note verranno cancellate dal profilo atleta. L&apos;operazione è esplicita e non
              elimina certificati o visite mediche.
            </p>
            <label
              className="mt-4 block text-sm font-medium text-zinc-800"
              htmlFor="clear-medical-notes-confirm"
            >
              Digita{" "}
              <span className="font-mono font-semibold">{ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN}</span> per
              confermare
            </label>
            <input
              id="clear-medical-notes-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-amber-500 focus:ring-2 disabled:opacity-70"
              placeholder={ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN}
            />
            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-70"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={!canConfirm || pending}
                onClick={onClear}
                className="rounded-lg border border-amber-300 bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Svuotamento..." : "Conferma svuotamento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
