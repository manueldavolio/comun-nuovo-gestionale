"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AccountingEntryType } from "@/generated/prisma/enums";
import { FINANCE_CATEGORY_LABEL, FINANCE_CATEGORY_VALUES, type FinanceCategory } from "@/lib/finance";
import { createFinanceEntrySchema, type CreateFinanceEntryInput } from "@/lib/validation/finance";

type FinanceEntryFieldErrors = Partial<Record<keyof CreateFinanceEntryInput, string>>;

const ENTRY_TYPE_OPTIONS: { value: AccountingEntryType; label: string }[] = [
  { value: "INCOME", label: "Entrata" },
  { value: "EXPENSE", label: "Uscita" },
];

type FinanceEntryFormState = {
  type: AccountingEntryType;
  category: FinanceCategory;
  amount: string;
  description: string;
  date: string;
  isForecast: boolean;
};

const INITIAL_FORM_STATE: FinanceEntryFormState = {
  type: "INCOME",
  category: "altro",
  amount: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
  isForecast: false,
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function FinanceEntryForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<FinanceEntryFormState>(INITIAL_FORM_STATE);
  const [fieldErrors, setFieldErrors] = useState<FinanceEntryFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(null);
    setFieldErrors({});

    const parsed = createFinanceEntrySchema.safeParse({
      ...formData,
      amount: formData.amount.replace(",", "."),
    });

    if (!parsed.success) {
      const nextErrors: FinanceEntryFieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof CreateFinanceEntryInput] = issue.message;
        }
      });
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/finanze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita. Riprova.");
        setIsSubmitting(false);
        return;
      }

      setOk("Movimento salvato correttamente.");
      setFormData({
        ...INITIAL_FORM_STATE,
        date: formData.date,
      });
      setIsSubmitting(false);
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Nuovo movimento</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Registra una entrata/uscita reale o una uscita prevista per la previsione di bilancio.
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="type">
            Tipo
          </label>
          <select
            id="type"
            value={formData.type}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, type: event.target.value as AccountingEntryType }))
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          >
            {ENTRY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.type} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="category">
            Categoria
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, category: event.target.value as FinanceCategory }))
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          >
            {FINANCE_CATEGORY_VALUES.map((value) => (
              <option key={value} value={value}>
                {FINANCE_CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.category} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="amount">
            Importo (EUR)
          </label>
          <input
            id="amount"
            inputMode="decimal"
            value={formData.amount}
            onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.amount} />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700" htmlFor="date">
            Data
          </label>
          <input
            id="date"
            type="date"
            value={formData.date}
            onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.date} />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="description">
            Descrizione
          </label>
          <textarea
            id="description"
            rows={3}
            value={formData.description}
            onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Es. acquisto kit allenamento"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <FieldError message={fieldErrors.description} />
        </div>

        <label className="md:col-span-2 flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={formData.isForecast}
            onChange={(event) => setFormData((prev) => ({ ...prev, isForecast: event.target.checked }))}
            className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-600"
          />
          Segna come previsione (non entra nei totali attuali, ma nel bilancio previsto)
        </label>

        {error ? (
          <p className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {ok ? (
          <p className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {ok}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="md:col-span-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvataggio..." : "Aggiungi movimento"}
        </button>
      </form>
    </section>
  );
}
