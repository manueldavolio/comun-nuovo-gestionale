"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { EventType } from "@prisma/client";
import { EVENT_TYPE_CHOICES } from "@/lib/events";
import { bulkTrainingSchema, createEventSchema } from "@/lib/validation/events";

type CategoryOption = {
  id: string;
  name: string;
  birthYearsLabel: string;
};

type AdminEventFormsProps = {
  categories: CategoryOption[];
};

const weekdayOptions = [
  { value: 1, label: "Lunedi" },
  { value: 2, label: "Martedi" },
  { value: 3, label: "Mercoledi" },
  { value: 4, label: "Giovedi" },
  { value: 5, label: "Venerdi" },
  { value: 6, label: "Sabato" },
  { value: 0, label: "Domenica" },
];

export function AdminEventForms({ categories }: AdminEventFormsProps) {
  const router = useRouter();
  const defaultCategoryId = categories[0]?.id ?? "";

  const [singleForm, setSingleForm] = useState({
    title: "",
    type: "TRAINING" as EventType,
    startAt: "",
    location: "",
    categoryId: defaultCategoryId,
    notes: "",
  });
  const [bulkForm, setBulkForm] = useState({
    categoryId: defaultCategoryId,
    weekdays: [1, 3] as number[],
    startDate: "",
    endDate: "",
    time: "",
    location: "",
    notes: "",
  });
  const [singleStatus, setSingleStatus] = useState<{ error?: string; ok?: string }>({});
  const [bulkStatus, setBulkStatus] = useState<{ error?: string; ok?: string }>({});
  const [submittingSingle, setSubmittingSingle] = useState(false);
  const [submittingBulk, setSubmittingBulk] = useState(false);

  const hasCategories = useMemo(() => categories.length > 0, [categories.length]);

  function toggleWeekday(weekday: number) {
    setBulkForm((prev) => {
      const included = prev.weekdays.includes(weekday);
      const weekdays = included
        ? prev.weekdays.filter((day) => day !== weekday)
        : [...prev.weekdays, weekday];
      return { ...prev, weekdays: weekdays.sort((a, b) => a - b) };
    });
  }

  async function submitSingleForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSingleStatus({});

    const parsed = createEventSchema.safeParse(singleForm);
    if (!parsed.success) {
      setSingleStatus({ error: parsed.error.issues[0]?.message ?? "Dati non validi." });
      return;
    }

    setSubmittingSingle(true);

    try {
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | { success: boolean }
        | null;

      if (!response.ok) {
        setSingleStatus({ error: data && "error" in data ? data.error : "Creazione non riuscita." });
        setSubmittingSingle(false);
        return;
      }

      setSingleStatus({ ok: "Evento creato correttamente." });
      setSingleForm((prev) => ({ ...prev, title: "", startAt: "", location: "", notes: "" }));
      router.refresh();
    } catch {
      setSingleStatus({ error: "Errore imprevisto. Riprova." });
    } finally {
      setSubmittingSingle(false);
    }
  }

  async function submitBulkForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBulkStatus({});

    const parsed = bulkTrainingSchema.safeParse(bulkForm);
    if (!parsed.success) {
      setBulkStatus({ error: parsed.error.issues[0]?.message ?? "Dati non validi." });
      return;
    }

    setSubmittingBulk(true);

    try {
      const response = await fetch("/api/admin/events/bulk-trainings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; created?: number }
        | null;

      if (!response.ok) {
        setBulkStatus({ error: data?.error ?? "Inserimento massivo non riuscito." });
        setSubmittingBulk(false);
        return;
      }

      setBulkStatus({ ok: `Allenamenti creati: ${data?.created ?? 0}.` });
      router.refresh();
    } catch {
      setBulkStatus({ error: "Errore imprevisto. Riprova." });
    } finally {
      setSubmittingBulk(false);
    }
  }

  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Calendario categorie</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Crea eventi singoli o genera automaticamente allenamenti ricorrenti.
      </p>

      {!hasCategories ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
          Nessuna categoria attiva disponibile.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <form onSubmit={submitSingleForm} className="rounded-lg border border-blue-100 p-3">
            <h3 className="text-base font-semibold text-zinc-900">Nuovo evento</h3>
            <div className="mt-3 grid gap-3">
              <label className="text-sm text-zinc-700">
                Titolo
                <input
                  value={singleForm.title}
                  onChange={(event) => setSingleForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>

              <label className="text-sm text-zinc-700">
                Tipo
                <select
                  value={singleForm.type}
                  onChange={(event) =>
                    setSingleForm((prev) => ({ ...prev, type: event.target.value as EventType }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                >
                  {EVENT_TYPE_CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-zinc-700">
                Data e ora
                <input
                  type="datetime-local"
                  value={singleForm.startAt}
                  onChange={(event) =>
                    setSingleForm((prev) => ({ ...prev, startAt: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>

              <label className="text-sm text-zinc-700">
                Luogo
                <input
                  value={singleForm.location}
                  onChange={(event) =>
                    setSingleForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>

              <label className="text-sm text-zinc-700">
                Categoria
                <select
                  value={singleForm.categoryId}
                  onChange={(event) =>
                    setSingleForm((prev) => ({ ...prev, categoryId: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.birthYearsLabel})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-zinc-700">
                Note
                <textarea
                  rows={3}
                  value={singleForm.notes}
                  onChange={(event) => setSingleForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>
            </div>

            {singleStatus.error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {singleStatus.error}
              </p>
            ) : null}
            {singleStatus.ok ? (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {singleStatus.ok}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submittingSingle}
              className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              {submittingSingle ? "Salvataggio..." : "Crea evento"}
            </button>
          </form>

          <form onSubmit={submitBulkForm} className="rounded-lg border border-blue-100 p-3">
            <h3 className="text-base font-semibold text-zinc-900">Inserimento massivo allenamenti</h3>

            <div className="mt-3 grid gap-3">
              <label className="text-sm text-zinc-700">
                Categoria
                <select
                  value={bulkForm.categoryId}
                  onChange={(event) =>
                    setBulkForm((prev) => ({ ...prev, categoryId: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.birthYearsLabel})
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="text-sm text-zinc-700">Giorni settimana</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {weekdayOptions.map((option) => {
                    const selected = bulkForm.weekdays.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleWeekday(option.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          selected
                            ? "border-blue-700 bg-blue-700 text-white"
                            : "border-zinc-300 text-zinc-700 hover:border-blue-400"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="text-sm text-zinc-700">
                Orario
                <input
                  type="time"
                  value={bulkForm.time}
                  onChange={(event) => setBulkForm((prev) => ({ ...prev, time: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-zinc-700">
                  Da
                  <input
                    type="date"
                    value={bulkForm.startDate}
                    onChange={(event) =>
                      setBulkForm((prev) => ({ ...prev, startDate: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                  />
                </label>
                <label className="text-sm text-zinc-700">
                  A
                  <input
                    type="date"
                    value={bulkForm.endDate}
                    onChange={(event) => setBulkForm((prev) => ({ ...prev, endDate: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                  />
                </label>
              </div>

              <label className="text-sm text-zinc-700">
                Luogo
                <input
                  value={bulkForm.location}
                  onChange={(event) =>
                    setBulkForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>

              <label className="text-sm text-zinc-700">
                Note
                <textarea
                  rows={3}
                  value={bulkForm.notes}
                  onChange={(event) => setBulkForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>
            </div>

            {bulkStatus.error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {bulkStatus.error}
              </p>
            ) : null}
            {bulkStatus.ok ? (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {bulkStatus.ok}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submittingBulk}
              className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              {submittingBulk ? "Creazione..." : "Crea allenamenti"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
