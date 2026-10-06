"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  moveSessionItemDown,
  moveSessionItemUp,
  sumSessionDurationMin,
} from "@/lib/training-session";

export type SessionItemDraft = {
  key: string;
  exerciseId: string | null;
  title: string;
  description: string;
  durationMin: string;
};

export type LibraryExerciseOption = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number | null;
};

type TrainingSessionEditorProps = {
  eventId: string;
  eventTitle: string;
  categoryName: string | null;
  backHref: string;
  initialNotes: string;
  initialItems: SessionItemDraft[];
  libraryExercises: LibraryExerciseOption[];
};

function newKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

export function TrainingSessionEditor({
  eventId,
  eventTitle,
  categoryName,
  backHref,
  initialNotes,
  initialItems,
  libraryExercises,
}: TrainingSessionEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [items, setItems] = useState<SessionItemDraft[]>(initialItems);
  const [addMode, setAddMode] = useState<"closed" | "choose" | "library" | "free">(
    "closed",
  );
  const [freeTitle, setFreeTitle] = useState("");
  const [freeDescription, setFreeDescription] = useState("");
  const [freeDuration, setFreeDuration] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; ok?: string }>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const totalDuration = useMemo(
    () =>
      sumSessionDurationMin(
        items.map((item) => ({
          durationMin: item.durationMin.trim() === "" ? null : Number(item.durationMin),
        })),
      ),
    [items],
  );

  function addFromLibrary(exercise: LibraryExerciseOption) {
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        exerciseId: exercise.id,
        title: exercise.title,
        description: exercise.description ?? "",
        durationMin:
          exercise.durationMin == null ? "" : String(exercise.durationMin),
      },
    ]);
    setAddMode("closed");
    setFeedback({});
  }

  async function addFreeItem() {
    const title = freeTitle.trim();
    if (!title) {
      setFeedback({ error: "Titolo obbligatorio." });
      return;
    }
    let exerciseId: string | null = null;
    if (saveToLibrary) {
      const res = await fetch("/api/mister/training-exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: freeDescription.trim() || null,
          durationMin: freeDuration.trim() === "" ? null : Number(freeDuration),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ error: data.error ?? "Salvataggio in libreria non riuscito." });
        return;
      }
      exerciseId = data.exercise?.id ?? null;
    }
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        exerciseId,
        title,
        description: freeDescription.trim(),
        durationMin: freeDuration.trim(),
      },
    ]);
    setFreeTitle("");
    setFreeDescription("");
    setFreeDuration("");
    setSaveToLibrary(false);
    setAddMode("closed");
    setFeedback({});
  }

  function updateItem(key: string, patch: Partial<SessionItemDraft>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key));
    if (editingKey === key) setEditingKey(null);
  }

  function move(index: number, dir: "up" | "down") {
    setItems((prev) => {
      const withOrder = prev.map((item, i) => ({ ...item, sortOrder: i }));
      const next =
        dir === "up"
          ? moveSessionItemUp(withOrder, index)
          : moveSessionItemDown(withOrder, index);
      return next.map((row) => ({
        key: row.key,
        exerciseId: row.exerciseId,
        title: row.title,
        description: row.description,
        durationMin: row.durationMin,
      }));
    });
  }

  async function save() {
    setPending(true);
    setFeedback({});
    try {
      const res = await fetch(`/api/mister/events/${eventId}/training-session`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || null,
          items: items.map((item) => ({
            exerciseId: item.exerciseId,
            title: item.title,
            description: item.description.trim() || null,
            durationMin: item.durationMin.trim() === "" ? null : Number(item.durationMin),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ error: data.error ?? "Salvataggio non riuscito." });
        return;
      }
      setFeedback({ ok: "Programma salvato." });
    } catch {
      setFeedback({ error: "Errore di rete." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-sky-50"
      >
        ← {eventTitle}
      </Link>

      <section className="rounded-2xl border border-blue-700 bg-blue-800 p-5 text-white shadow-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
          Programma seduta{categoryName ? ` · ${categoryName}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">{eventTitle}</h1>
        <p className="mt-2 text-sm text-sky-100">
          Durata prevista:{" "}
          <span className="font-bold text-white">{totalDuration} min</span>
        </p>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-zinc-800">
          Nota tecnica (solo staff)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Es. Focus sulla costruzione dal basso."
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-blue-800">
            Programma
          </h2>
          <button
            type="button"
            onClick={() => setAddMode(addMode === "closed" ? "choose" : "closed")}
            className="inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900"
          >
            + Aggiungi esercizio
          </button>
        </div>

        {addMode === "choose" ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setAddMode("library")}
              className="min-h-11 rounded-xl border border-blue-200 bg-sky-50 px-3 text-sm font-bold text-blue-900"
            >
              Libreria
            </button>
            <button
              type="button"
              onClick={() => setAddMode("free")}
              className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-blue-900"
            >
              Nuovo / Libero
            </button>
          </div>
        ) : null}

        {addMode === "library" ? (
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-sky-100 bg-sky-50/50 p-2">
            {libraryExercises.length === 0 ? (
              <p className="p-2 text-sm text-zinc-600">Nessun esercizio in libreria.</p>
            ) : (
              libraryExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => addFromLibrary(ex)}
                  className="flex min-h-11 w-full flex-col items-start rounded-xl border border-blue-100 bg-white px-3 py-2 text-left hover:bg-sky-50"
                >
                  <span className="font-semibold text-zinc-900">{ex.title}</span>
                  <span className="text-xs text-zinc-500">
                    {ex.durationMin != null ? `${ex.durationMin} min` : "Durata libera"}
                  </span>
                </button>
              ))
            )}
            <button
              type="button"
              onClick={() => setAddMode("choose")}
              className="min-h-11 w-full rounded-xl text-sm font-semibold text-blue-800"
            >
              Indietro
            </button>
          </div>
        ) : null}

        {addMode === "free" ? (
          <div className="mt-3 space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-3">
            <input
              value={freeTitle}
              onChange={(e) => setFreeTitle(e.target.value)}
              placeholder="Titolo"
              className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm"
            />
            <textarea
              value={freeDescription}
              onChange={(e) => setFreeDescription(e.target.value)}
              placeholder="Descrizione (opzionale)"
              rows={2}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              value={freeDuration}
              onChange={(e) => setFreeDuration(e.target.value)}
              placeholder="Durata min"
              inputMode="numeric"
              className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm"
            />
            <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={saveToLibrary}
                onChange={(e) => setSaveToLibrary(e.target.checked)}
                className="h-5 w-5"
              />
              Salva anche nella libreria
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void addFreeItem()}
                className="min-h-11 flex-1 rounded-xl bg-blue-800 text-sm font-bold text-white"
              >
                Aggiungi
              </button>
              <button
                type="button"
                onClick={() => setAddMode("choose")}
                className="min-h-11 rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-800"
              >
                Indietro
              </button>
            </div>
          </div>
        ) : null}

        <ol className="mt-4 space-y-2">
          {items.length === 0 ? (
            <li className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
              Nessun esercizio. Aggiungi dalla libreria o crea uno libero.
            </li>
          ) : (
            items.map((item, index) => (
              <li
                key={item.key}
                className="rounded-2xl border border-blue-100 bg-sky-50/30 p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-800 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {editingKey === item.key ? (
                      <div className="space-y-2">
                        <input
                          value={item.title}
                          onChange={(e) => updateItem(item.key, { title: e.target.value })}
                          className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm"
                        />
                        <textarea
                          value={item.description}
                          onChange={(e) =>
                            updateItem(item.key, { description: e.target.value })
                          }
                          rows={2}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                        />
                        <input
                          value={item.durationMin}
                          onChange={(e) =>
                            updateItem(item.key, { durationMin: e.target.value })
                          }
                          placeholder="min"
                          inputMode="numeric"
                          className="min-h-11 w-28 rounded-xl border border-zinc-300 px-3 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingKey(null)}
                          className="min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white"
                        >
                          Chiudi
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-zinc-900">{item.title}</p>
                        {item.description ? (
                          <p className="mt-0.5 text-sm text-zinc-600">{item.description}</p>
                        ) : null}
                        <p className="mt-1 text-xs font-semibold text-blue-800">
                          {item.durationMin.trim()
                            ? `${item.durationMin} min`
                            : "Durata non indicata"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => move(index, "up")}
                    disabled={index === 0}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-sm font-bold text-blue-800 disabled:opacity-40"
                    aria-label="Sposta su"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, "down")}
                    disabled={index === items.length - 1}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-sm font-bold text-blue-800 disabled:opacity-40"
                    aria-label="Sposta giù"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingKey(editingKey === item.key ? null : item.key)
                    }
                    className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800"
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="min-h-11 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700"
                  >
                    Rimuovi
                  </button>
                </div>
              </li>
            ))
          )}
        </ol>

        <p className="mt-4 text-sm font-bold text-zinc-800">
          Durata totale: {totalDuration} min
        </p>

        {feedback.error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {feedback.error}
          </p>
        ) : null}
        {feedback.ok ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {feedback.ok}
          </p>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-800 text-sm font-bold uppercase tracking-wide text-white hover:bg-blue-900 disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva programma"}
        </button>
      </section>

      <p className="text-center text-sm">
        <Link href="/mister/libreria-esercizi" className="font-semibold text-blue-800 underline">
          Apri libreria esercizi
        </Link>
      </p>
    </div>
  );
}
