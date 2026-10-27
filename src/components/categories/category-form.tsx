"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PLAYERS_PER_SIDE_OPTIONS, type PlayersPerSide } from "@/lib/category-format";
import {
  CATEGORY_SECTOR_LABELS,
  CATEGORY_SECTOR_VALUES,
  type CategorySectorValue,
} from "@/lib/category-sector";
import { upsertCategorySchema, type UpsertCategoryInput } from "@/lib/validation/categories";

type CategoryFormProps = {
  mode: "create" | "edit";
  categoryId?: string;
  initialValues: {
    name: string;
    birthYearsLabel: string;
    isActive: boolean;
    playersPerSide: PlayersPerSide;
    /** null = ancora da classificare (solo record legacy in edit). */
    sector: CategorySectorValue | null;
  };
};

type CategoryFieldErrors = Partial<Record<keyof UpsertCategoryInput, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-blue-950 outline-none ring-blue-500 focus:ring-2";

export function CategoryForm({ mode, categoryId, initialValues }: CategoryFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: initialValues.name,
    birthYearsLabel: initialValues.birthYearsLabel,
    isActive: initialValues.isActive,
    playersPerSide: initialValues.playersPerSide,
    sector: (initialValues.sector ?? "") as CategorySectorValue | "",
  });
  const [fieldErrors, setFieldErrors] = useState<CategoryFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = mode === "create" ? "/api/admin/categories" : `/api/admin/categories/${categoryId}`;
  const method = mode === "create" ? "POST" : "PUT";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = upsertCategorySchema.safeParse({
      ...formData,
      sector: formData.sector === "" ? undefined : formData.sector,
    });
    if (!parsed.success) {
      const nextErrors: CategoryFieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof UpsertCategoryInput] = issue.message;
        }
      });
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita. Riprova.");
        setIsSubmitting(false);
        return;
      }

      router.push("/admin/categorie");
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-black text-blue-950">
          {mode === "create" ? "Nuova categoria" : "Modifica categoria"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Nome, annata/descrizione, formato partita, classificazione settore e stato operativo.
        </p>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="text-sm font-bold text-blue-950" htmlFor="name">
              Nome categoria
            </label>
            <input
              id="name"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.name} />
          </div>

          <div>
            <label className="text-sm font-bold text-blue-950" htmlFor="birthYearsLabel">
              Annata / descrizione
            </label>
            <input
              id="birthYearsLabel"
              value={formData.birthYearsLabel}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, birthYearsLabel: event.target.value }))
              }
              placeholder="es. 2016-2017"
              className={inputClass}
            />
            <FieldError message={fieldErrors.birthYearsLabel} />
          </div>

          <div>
            <label className="text-sm font-bold text-blue-950" htmlFor="playersPerSide">
              Formato partita
            </label>
            <select
              id="playersPerSide"
              value={formData.playersPerSide}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  playersPerSide: Number(event.target.value) as PlayersPerSide,
                }))
              }
              className={inputClass}
            >
              {PLAYERS_PER_SIDE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs font-medium text-zinc-500">
              Primi Calci 5 · Pulcini 7 · Esordienti 9 · altre 11
            </p>
            <FieldError message={fieldErrors.playersPerSide} />
          </div>

          <div>
            <label className="text-sm font-bold text-blue-950" htmlFor="sector">
              Settore
            </label>
            <select
              id="sector"
              value={formData.sector}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  sector: event.target.value as CategorySectorValue | "",
                }))
              }
              className={inputClass}
              required
            >
              <option value="" disabled>
                Seleziona classificazione…
              </option>
              {CATEGORY_SECTOR_VALUES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_SECTOR_LABELS[value]}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs font-medium text-zinc-500">
              Obbligatoria. Nessun valore predefinito: scegli esplicitamente giovanile o Prima Squadra.
            </p>
            <FieldError message={fieldErrors.sector} />
          </div>

          <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm font-semibold text-blue-950">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-sky-300 text-blue-800 focus:ring-blue-500"
            />
            Categoria attiva
          </label>
          <FieldError message={fieldErrors.isActive} />
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-800 px-4 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvataggio..." : mode === "create" ? "Crea categoria" : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
