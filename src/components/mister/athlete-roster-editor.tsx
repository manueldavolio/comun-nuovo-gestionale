"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Shirt } from "lucide-react";
import {
  ATHLETE_ROLE_CHOICES,
  formatAthleteRoleDisplay,
  hasAssignedAthleteRole,
  parseCanonicalAthleteRole,
  type AthleteRoleCode,
} from "@/lib/athlete-roles";
import { athleteInitials } from "@/lib/parent-season";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const monthLabel = MONTH_LABELS[noteMonth] ?? String(noteMonth);
  const missingRoleCount = useMemo(
    () => rows.filter((row) => !hasAssignedAthleteRole(row.position)).length,
    [rows],
  );

  function setRole(athleteId: string, role: AthleteRoleCode | null) {
    setRows((prev) =>
      prev.map((row) => (row.id === athleteId ? { ...row, position: role } : row)),
    );
    setFeedback((prev) => ({ ...prev, [athleteId]: "" }));
  }

  async function saveProfile(athleteId: string) {
    const row = rows.find((item) => item.id === athleteId);
    if (!row) return;

    setPendingId(athleteId);
    setFeedback((prev) => ({ ...prev, [athleteId]: "" }));

    try {
      const response = await fetch(`/api/mister/athletes/${athleteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: row.position,
          shirtNumber: row.shirtNumber,
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
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-zinc-900">Rosa</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Nota di {monthLabel} {noteYear} — opzionale, visibile ai genitori dell&apos;atleta.
        </p>
      </div>

      {missingRoleCount > 0 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Completa i ruoli della squadra per utilizzare tutte le funzioni Fanta.{" "}
          <span className="font-semibold">
            {missingRoleCount === 1
              ? "1 giocatore senza ruolo."
              : `${missingRoleCount} giocatori senza ruolo.`}
          </span>
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((athlete) => {
          const hasNote = Boolean((athlete.noteContent ?? "").trim());
          const open = expandedId === athlete.id;
          const initials = athleteInitials(athlete.firstName, athlete.lastName);
          const canonical = parseCanonicalAthleteRole(athlete.position);
          const roleAssigned = hasAssignedAthleteRole(athlete.position);
          const legacyLabel =
            !roleAssigned && (athlete.position ?? "").trim()
              ? (athlete.position ?? "").trim()
              : null;

          return (
            <li
              key={athlete.id}
              className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : athlete.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-800 text-base font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-zinc-900">
                    {athlete.firstName} {athlete.lastName}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Shirt className="h-3.5 w-3.5" />
                      {athlete.shirtNumber != null ? `#${athlete.shirtNumber}` : "Maglia —"}
                    </span>
                    <span>{formatAthleteRoleDisplay(athlete.position)}</span>
                  </p>
                  {!roleAssigned ? (
                    <span className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                      Ruolo da assegnare
                    </span>
                  ) : null}
                  {hasNote ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Nota {monthLabel.toLowerCase()}
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex text-[11px] font-semibold text-amber-700">
                      Nota da compilare
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-blue-700">{open ? "Chiudi" : "Modifica"}</span>
              </button>

              {open ? (
                <div className="border-t border-blue-50 bg-sky-50/40 p-4">
                  <p className="text-sm font-bold uppercase tracking-wide text-blue-900">
                    {athlete.firstName} {athlete.lastName}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-zinc-700">Ruolo</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {ATHLETE_ROLE_CHOICES.map((choice) => {
                          const active = canonical === choice.value;
                          return (
                            <button
                              key={choice.value}
                              type="button"
                              onClick={() => setRole(athlete.id, choice.value)}
                              className={`min-h-11 rounded-xl border px-2 text-xs font-bold uppercase tracking-wide ${
                                active
                                  ? "border-blue-700 bg-blue-800 text-white"
                                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-sky-50"
                              }`}
                              title={choice.label}
                            >
                              {choice.value}
                            </button>
                          );
                        })}
                      </div>
                      {legacyLabel ? (
                        <p className="mt-2 text-xs text-amber-800">
                          Valore precedente: {legacyLabel}. Seleziona un ruolo standard (POR / DIF /
                          CEN / ATT).
                        </p>
                      ) : null}
                      {!roleAssigned && !legacyLabel ? (
                        <p className="mt-2 text-xs font-semibold text-amber-800">
                          Ruolo da assegnare
                        </p>
                      ) : null}
                      {canonical ? (
                        <button
                          type="button"
                          onClick={() => setRole(athlete.id, null)}
                          className="mt-2 text-xs font-semibold text-zinc-500 underline"
                        >
                          Rimuovi ruolo
                        </button>
                      ) : null}
                    </div>
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
                        className="mt-1 block min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={
                      pendingId === athlete.id ||
                      Boolean(
                        athlete.position && !parseCanonicalAthleteRole(athlete.position),
                      )
                    }
                    onClick={() => saveProfile(athlete.id)}
                    className="mt-3 min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
                  >
                    Salva ruolo/maglia
                  </button>

                  <label className="mt-4 block text-xs font-medium text-zinc-700">
                    Nota di {monthLabel}
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
                      rows={3}
                      className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                      placeholder="Nota privata sul mese in corso..."
                    />
                  </label>
                  <button
                    type="button"
                    disabled={pendingId === athlete.id || !(athlete.noteContent ?? "").trim()}
                    onClick={() => saveNote(athlete.id)}
                    className="mt-3 min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    Salva nota
                  </button>
                  {feedback[athlete.id] ? (
                    <p className="mt-2 text-xs font-semibold text-zinc-600">{feedback[athlete.id]}</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
