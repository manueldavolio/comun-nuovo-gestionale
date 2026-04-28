"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteButtonProps = {
  endpoint: string;
  confirmMessage?: string;
  successMessage?: string;
  className?: string;
  label?: string;
};

export function DeleteButton({
  endpoint,
  confirmMessage = "Sei sicuro di voler eliminare?",
  successMessage,
  className,
  label = "Elimina",
}: DeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onDelete() {
    setError(null);
    setOk(null);

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? "Eliminazione non riuscita.");
        setIsDeleting(false);
        return;
      }

      setOk(successMessage ?? "Elemento eliminato correttamente.");
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className={
          className ??
          "inline-flex rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
        }
      >
        {isDeleting ? "Eliminazione..." : label}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {ok ? <p className="text-xs text-emerald-700">{ok}</p> : null}
    </div>
  );
}
