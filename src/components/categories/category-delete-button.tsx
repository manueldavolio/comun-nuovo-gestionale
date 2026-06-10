"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CategoryDeleteButtonProps = {
  categoryId: string;
};

export function CategoryDeleteButton({ categoryId }: CategoryDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onDelete() {
    setError(null);
    setOk(null);

    if (!window.confirm("Sei sicuro di voler eliminare questa categoria?")) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        deactivated?: boolean;
        message?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Eliminazione non riuscita.");
        setIsDeleting(false);
        return;
      }

      if (data?.deactivated) {
        setOk(data.message ?? "Categoria disattivata perché contiene dati collegati.");
        router.refresh();
        setIsDeleting(false);
        return;
      }

      router.push("/admin/categorie");
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="inline-flex w-fit rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isDeleting ? "Eliminazione..." : "Elimina categoria"}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {ok ? <p className="text-xs text-amber-700">{ok}</p> : null}
    </div>
  );
}
