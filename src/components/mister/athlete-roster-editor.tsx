"use client";

import { useState } from "react";

type AthleteRosterEditorProps = {
  athletes: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
    shirtNumber: number | null;
    noteContent: string | null;
  }>;
  noteYear: number;
  noteMonth: number;
};

const MONTH_LABELS = [
  "",
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export function AthleteRosterEditor({ athletes, noteYear, noteMonth }: AthleteRosterEditorProps) {
  const [rows, setRows] = useState(athletes);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  async function saveProfile(athleteId: string) {
    const row = rows.find((item) => item.id === athleteId);
    if (!row) return;

    setPendingId(athleteId);
    setFeedback((prev) => ({ ...prev, [athleteId]: "" }));

    try {
      const shirtRaw = row.shirtNumber;
      const response = await fetch(`/api/mister/athletes/${athleteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: row.position,
          shirtNumber: shirtRaw,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback((prev) => ({
          ...prev,
          [athleteId]: data?.error ?? "Salvataggio profilo non riuscito.",
        }));
        return;
      }
      setFeedback((prev) => ({ ...prev, [athleteId]: "Profilo salvato." }));
    } catch {
      setFeedback((prev) => ({ ...prev, [athleteId]: "Errore imprevisto." }));
    } finally {
      setPendingId(null);
    }
  }

  async function saveNote(athleteId: string) {
    const row = rows.find((item) => item.id === athleteId);
    if (!row) return;

    setPendingId(athleteId);
    setFeedback((prev) => ({ ...prev, [athleteId]: "" }));

    try {
      const response = await fetch(`/api/mister/athletes/${athleteId}/coach-note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: noteYear,
          month: noteMonth,
          content: (row.noteContent ?? "").trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback((prev) => ({
          ...prev,
          [athleteId]: data?.error ?? "Salvataggio nota non riuscito.",
        }));
        return;
      }
      setFeedback((prev) => ({ ...prev, [athleteId]: "Nota salvata." }));
    } catch {
      setFeedback((prev) => ({ ...prev, [athleteId]: "Errore imprevisto." }));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Ruolo, maglia e nota mensile</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Nota di {MONTH_LABELS[noteMonth]} {noteYear} — visibile ai genitori del singolo atleta.
      </p>

      <ul className="mt-4 space-y-3">
        {rows.map((athlete) => (
          <li key={athlete.id} className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
            <p className="text-sm font-semibold text-zinc-900">
              {athlete.firstName} {athlete.lastName}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-medium text-zinc-700">
                Ruolo
                <input
                  value={athlete.position ?? ""}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((row) =>
                        row.id === athlete.id
                          ? { ...row, position: event.target.value || null }
                          : row,
                      ),
                    )
                  }
                  placeholder="Es. Difensore"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>
              <label className="text-xs font-medium text-zinc-700">
                Numero maglia
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={athlete.shirtNumber ?? ""}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((row) =>
                        row.id === athlete.id
                          ? {
                              ...row,
                              shirtNumber:
                                event.target.value === ""
                                  ? null
                                  : Number.parseInt(event.target.value, 10) || 0,
                            }
                          : row,
                      ),
                    )
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs font-medium text-zinc-700">
              Nota mister
              <textarea
                value={athlete.noteContent ?? ""}
                onChange={(event) =>
                  setRows((prev) =>
                    prev.map((row) =>
                      row.id === athlete.id
                        ? { ...row, noteContent: event.target.value }
                        : row,
                    ),
                  )
                }
                rows={2}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                placeholder="Nota privata sul mese in corso..."
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pendingId === athlete.id}
                onClick={() => saveProfile(athlete.id)}
                className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                Salva ruolo/maglia
              </button>
              <button
                type="button"
                disabled={pendingId === athlete.id || !(athlete.noteContent ?? "").trim()}
                onClick={() => saveNote(athlete.id)}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
              >
                Salva nota mese
              </button>
            </div>
            {feedback[athlete.id] ? (
              <p className="mt-2 text-xs text-zinc-600">{feedback[athlete.id]}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
