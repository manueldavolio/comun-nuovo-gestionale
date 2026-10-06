"use client";

import { useState } from "react";
import Link from "next/link";

export type LibraryExerciseRow = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number | null;
  materials: string | null;
  categoryId: string | null;
  categoryName: string | null;
};

type ExerciseLibraryManagerProps = {
  initialExercises: LibraryExerciseRow[];
  categories: Array<{ id: string; name: string }>;
};

export function ExerciseLibraryManager({
  initialExercises,
  categories,
}: ExerciseLibraryManagerProps) {
  const [exercises, setExercises] = useState(initialExercises);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [materials, setMaterials] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; ok?: string }>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  async function createExercise() {
    setPending(true);
    setFeedback({});
    try {
      const res = await fetch("/api/mister/training-exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim() || null,
          durationMin: durationMin.trim() === "" ? null : Number(durationMin),
          materials: materials.trim() || null,
          categoryId: categoryId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ error: data.error ?? "Creazione non riuscita." });
        return;
      }
      const ex = data.exercise;
      setExercises((prev) => [
        {
          id: ex.id,
          title: ex.title,
          description: ex.description,
          durationMin: ex.durationMin,
          materials: ex.materials,
          categoryId: ex.categoryId,
          categoryName: ex.category?.name ?? null,
        },
        ...prev,
      ]);
      setTitle("");
      setDescription("");
      setDurationMin("");
      setMaterials("");
      setCategoryId("");
      setFeedback({ ok: "Esercizio creato." });
    } catch {
      setFeedback({ error: "Errore di rete." });
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(row: LibraryExerciseRow) {
    setPending(true);
    setFeedback({});
    try {
      const res = await fetch(`/api/mister/training-exercises/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: row.title,
          description: row.description,
          durationMin: row.durationMin,
          materials: row.materials,
          categoryId: row.categoryId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ error: data.error ?? "Modifica non riuscita." });
        return;
      }
      const ex = data.exercise;
      setExercises((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                id: ex.id,
                title: ex.title,
                description: ex.description,
                durationMin: ex.durationMin,
                materials: ex.materials,
                categoryId: ex.categoryId,
                categoryName: ex.category?.name ?? null,
              }
            : item,
        ),
      );
      setEditingId(null);
      setFeedback({ ok: "Esercizio aggiornato. Le sedute già salvate non cambiano." });
    } catch {
      setFeedback({ error: "Errore di rete." });
    } finally {
      setPending(false);
    }
  }

  async function removeExercise(id: string) {
    if (!window.confirm("Eliminare questo esercizio dalla libreria? Le sedute storiche restano intatte.")) {
      return;
    }
    setPending(true);
    setFeedback({});
    try {
      const res = await fetch(`/api/mister/training-exercises/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ error: data.error ?? "Eliminazione non riuscita." });
        return;
      }
      setExercises((prev) => prev.filter((item) => item.id !== id));
      setFeedback({ ok: "Esercizio eliminato dalla libreria." });
    } catch {
      setFeedback({ error: "Errore di rete." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href="/mister"
        className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-sky-50"
      >
        ← Area Mister
      </Link>

      <section className="rounded-2xl border border-blue-700 bg-blue-800 p-5 text-white shadow-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
          Strumento tecnico
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">Libreria esercizi</h1>
        <p className="mt-2 text-sm text-sky-100">
          Template riutilizzabili. Le sedute usano uno snapshot: modificare qui non cambia i
          programmi già salvati.
        </p>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-blue-800">
          Nuovo esercizio
        </h2>
        <div className="mt-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titolo *"
            className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrizione (opzionale)"
            rows={2}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            placeholder="Durata suggerita (min)"
            inputMode="numeric"
            className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm"
          />
          <input
            value={materials}
            onChange={(e) => setMaterials(e.target.value)}
            placeholder="Materiale (opzionale)"
            className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm"
          >
            <option value="">Personale (solo tu)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                Condiviso · {cat.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() => void createExercise()}
            className="min-h-12 w-full rounded-xl bg-blue-800 text-sm font-bold text-white disabled:opacity-60"
          >
            Crea esercizio
          </button>
        </div>
      </section>

      {feedback.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {feedback.error}
        </p>
      ) : null}
      {feedback.ok ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {feedback.ok}
        </p>
      ) : null}

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-blue-800">
          I tuoi esercizi
        </h2>
        <ul className="mt-3 space-y-3">
          {exercises.length === 0 ? (
            <li className="text-sm text-zinc-500">Nessun esercizio ancora.</li>
          ) : (
            exercises.map((ex) => (
              <li key={ex.id} className="rounded-2xl border border-sky-100 bg-sky-50/30 p-3">
                {editingId === ex.id ? (
                  <div className="space-y-2">
                    <input
                      value={ex.title}
                      onChange={(e) =>
                        setExercises((prev) =>
                          prev.map((row) =>
                            row.id === ex.id ? { ...row, title: e.target.value } : row,
                          ),
                        )
                      }
                      className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm"
                    />
                    <textarea
                      value={ex.description ?? ""}
                      onChange={(e) =>
                        setExercises((prev) =>
                          prev.map((row) =>
                            row.id === ex.id
                              ? { ...row, description: e.target.value || null }
                              : row,
                          ),
                        )
                      }
                      rows={2}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={ex.durationMin ?? ""}
                      onChange={(e) =>
                        setExercises((prev) =>
                          prev.map((row) =>
                            row.id === ex.id
                              ? {
                                  ...row,
                                  durationMin:
                                    e.target.value.trim() === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : row,
                          ),
                        )
                      }
                      className="min-h-11 w-full rounded-xl border border-zinc-300 px-3 text-sm"
                      placeholder="Durata min"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void saveEdit(ex)}
                        className="min-h-11 flex-1 rounded-xl bg-blue-800 text-sm font-bold text-white"
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="min-h-11 rounded-xl border border-blue-200 px-3 text-sm font-semibold text-blue-800"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-bold text-zinc-900">{ex.title}</p>
                    {ex.description ? (
                      <p className="mt-1 text-sm text-zinc-600">{ex.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs font-semibold text-blue-800">
                      {ex.durationMin != null ? `${ex.durationMin} min` : "Durata libera"}
                      {ex.categoryName
                        ? ` · ${ex.categoryName}`
                        : " · Personale"}
                    </p>
                    {ex.materials ? (
                      <p className="mt-1 text-xs text-zinc-500">Materiale: {ex.materials}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(ex.id)}
                        className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800"
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void removeExercise(ex.id)}
                        className="min-h-11 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700"
                      >
                        Elimina
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
