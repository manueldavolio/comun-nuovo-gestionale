"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CategoryStatusToggleButtonProps = {
  categoryId: string;
  isActive: boolean;
};

export function CategoryStatusToggleButton({ categoryId, isActive }: CategoryStatusToggleButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/categories/${categoryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita.");
        setIsSubmitting(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Errore imprevisto.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={isSubmitting}
        className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Salvataggio..." : isActive ? "Disattiva" : "Attiva"}
      </button>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
