"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upsertCategorySchema, type UpsertCategoryInput } from "@/lib/validation/categories";

type CategoryFormProps = {
  mode: "create" | "edit";
  categoryId?: string;
  initialValues: {
    name: string;
    birthYearsLabel: string;
    isActive: boolean;
  };
};

type CategoryFieldErrors = Partial<Record<keyof UpsertCategoryInput, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function CategoryForm({ mode, categoryId, initialValues }: CategoryFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<CategoryFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = mode === "create" ? "/api/admin/categories" : `/api/admin/categories/${categoryId}`;
  const method = mode === "create" ? "POST" : "PUT";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = upsertCategorySchema.safeParse(formData);
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
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {mode === "create" ? "Nuova categoria" : "Modifica categoria"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Gestisci nome, annata/descrizione e stato operativo della categoria.
        </p>

        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="name">
              Nome categoria
            </label>
            <input
              id="name"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.name} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="birthYearsLabel">
              Annata / descrizione
            </label>
            <input
              id="birthYearsLabel"
              value={formData.birthYearsLabel}
              onChange={(event) => setFormData((prev) => ({ ...prev, birthYearsLabel: event.target.value }))}
              placeholder="es. 2016-2017"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.birthYearsLabel} />
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            Categoria attiva
          </label>
          <FieldError message={fieldErrors.isActive} />
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvataggio..." : mode === "create" ? "Crea categoria" : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
