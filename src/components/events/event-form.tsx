"use client";

import { useState, type FormEvent } from "react";
import type { EventType } from "@prisma/client";
import { EVENT_TYPE_CHOICES, EVENT_TYPE_LABEL } from "@/lib/events";
import { createEventSchema, updateEventSchema } from "@/lib/validation/events";

export type EventFormCategoryOption = {
  id: string;
  name: string;
  birthYearsLabel: string;
};

export type EventFormValues = {
  title: string;
  type: EventType;
  startAt: string;
  location: string;
  categoryId: string;
  notes: string;
  sendEmail?: boolean;
};

type EventFormProps = {
  categories: EventFormCategoryOption[];
  initialValues: EventFormValues;
  mode: "create" | "edit";
  title?: string;
  submitLabel: string;
  submittingLabel?: string;
  onSubmit: (values: EventFormValues) => Promise<{ error?: string; ok?: string } | void>;
};

export function EventForm({
  categories,
  initialValues,
  mode,
  title,
  submitLabel,
  submittingLabel = "Salvataggio...",
  onSubmit,
}: EventFormProps) {
  const [form, setForm] = useState<EventFormValues>(initialValues);
  const [status, setStatus] = useState<{ error?: string; ok?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const typeChoices = (() => {
    const base = [...EVENT_TYPE_CHOICES];
    if (!base.some((choice) => choice.value === form.type)) {
      base.unshift({
        value: form.type,
        label: EVENT_TYPE_LABEL[form.type] ?? form.type,
      });
    }
    return base;
  })();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({});

    const schema = mode === "create" ? createEventSchema : updateEventSchema;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setStatus({ error: parsed.error.issues[0]?.message ?? "Dati non validi." });
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit({
        ...form,
        ...parsed.data,
        sendEmail: mode === "create" ? Boolean(form.sendEmail) : undefined,
      });
      if (result?.error) {
        setStatus({ error: result.error });
        return;
      }
      if (result?.ok) {
        setStatus({ ok: result.ok });
      }
      if (mode === "create") {
        setForm((prev) => ({
          ...prev,
          title: "",
          startAt: "",
          location: "",
          notes: "",
          sendEmail: false,
        }));
      }
    } catch {
      setStatus({ error: "Errore imprevisto. Riprova." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-blue-100 p-3">
      {title ? <h3 className="text-base font-semibold text-zinc-900">{title}</h3> : null}
      <div className={title ? "mt-3 grid gap-3" : "grid gap-3"}>
        <label className="text-sm text-zinc-700">
          Titolo
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>

        <label className="text-sm text-zinc-700">
          Tipo
          <select
            value={form.type}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, type: event.target.value as EventType }))
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          >
            {typeChoices.map((choice) => (
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
            value={form.startAt}
            onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>

        <label className="text-sm text-zinc-700">
          Luogo
          <input
            value={form.location}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>

        <label className="text-sm text-zinc-700">
          Categoria
          <select
            value={form.categoryId}
            onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
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
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>

        {mode === "create" ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={Boolean(form.sendEmail)}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  sendEmail: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            Invia anche email
          </label>
        ) : null}
      </div>

      {status.error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {status.error}
        </p>
      ) : null}
      {status.ok ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status.ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
