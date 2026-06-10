"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CategoryOption = {
  id: string;
  name: string;
  seasonLabel: string;
  birthYearsLabel: string;
};

type ChangeAthleteCategoryInlineProps = {
  athleteId: string;
  currentCategoryId: string;
  categories: CategoryOption[];
};

export function ChangeAthleteCategoryInline({
  athleteId,
  currentCategoryId,
  categories,
}: ChangeAthleteCategoryInlineProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleCategoryChange(nextCategoryId: string) {
    setMessage("");

    if (!nextCategoryId || nextCategoryId === currentCategoryId) {
      setIsOpen(false);
      return;
    }

    try {
      const response = await fetch(`/api/admin/athletes/${athleteId}/category`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: nextCategoryId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage(payload?.error ?? "Aggiornamento non riuscito.");
        return;
      }

      setMessage("Categoria aggiornata.");
      setIsOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setMessage("Errore di rete. Riprova.");
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setIsOpen(true);
          }}
          className="inline-flex w-fit items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          Cambia categoria
        </button>
      ) : (
        <select
          aria-label="Seleziona nuova categoria"
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none ring-blue-500 focus:ring-2"
          defaultValue={currentCategoryId}
          onChange={(event) => {
            void handleCategoryChange(event.target.value);
          }}
          disabled={isPending}
          autoFocus
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.seasonLabel}) - {category.birthYearsLabel}
            </option>
          ))}
        </select>
      )}

      {message ? <span className="text-xs text-zinc-600">{message}</span> : null}
      {isPending ? <span className="text-xs text-zinc-500">Salvataggio...</span> : null}
    </div>
  );
}
