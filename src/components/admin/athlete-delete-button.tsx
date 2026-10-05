"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ATHLETE_DELETE_CONFIRM_TOKEN } from "@/lib/admin-athlete-delete";

type AthleteDeleteButtonProps = {
  athleteId: string;
  firstName: string;
  lastName: string;
  categoryName: string;
  categorySeasonLabel: string;
};

export function AthleteDeleteButton({
  athleteId,
  firstName,
  lastName,
  categoryName,
  categorySeasonLabel,
}: AthleteDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = useMemo(
    () => `${firstName} ${lastName}`.trim(),
    [firstName, lastName],
  );

  const canConfirm = confirmText.trim() === ATHLETE_DELETE_CONFIRM_TOKEN;

  function closeModal() {
    if (isDeleting) return;
    setOpen(false);
    setConfirmText("");
    setError(null);
  }

  async function onConfirmDelete() {
    if (!canConfirm || isDeleting) return;

    setError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/athletes/${athleteId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Eliminazione non riuscita.");
        setIsDeleting(false);
        return;
      }

      router.push("/admin/atleti?deleted=1");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmText("");
          setOpen(true);
        }}
        className="inline-flex items-center rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
      >
        Elimina atleta
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="athlete-delete-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-xl">
            <h3 id="athlete-delete-title" className="text-lg font-semibold text-zinc-900">
              Conferma eliminazione
            </h3>
            <p className="mt-3 text-sm text-zinc-700">
              Stai per eliminare definitivamente{" "}
              <span className="font-semibold text-zinc-900">{fullName}</span>.
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Categoria:{" "}
              <span className="font-medium text-zinc-900">
                {categoryName} ({categorySeasonLabel})
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">ID atleta: {athleteId}</p>
            <p className="mt-3 text-sm font-medium text-red-700">
              Questa operazione non può essere annullata.
            </p>

            <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor="athlete-delete-confirm">
              Digita <span className="font-mono font-semibold">{ATHLETE_DELETE_CONFIRM_TOKEN}</span> per
              confermare
            </label>
            <input
              id="athlete-delete-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={isDeleting}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-red-500 focus:ring-2 disabled:opacity-70"
              placeholder={ATHLETE_DELETE_CONFIRM_TOKEN}
            />

            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isDeleting}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-70"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={!canConfirm || isDeleting}
                className="rounded-lg border border-red-300 bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Eliminazione..." : "Elimina definitivamente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
