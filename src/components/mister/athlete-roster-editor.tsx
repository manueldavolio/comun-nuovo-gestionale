"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Shirt, Target, Trash2 } from "lucide-react";
import {
  ATHLETE_ROLE_CHOICES,
  formatAthleteRoleDisplay,
  hasAssignedAthleteRole,
  parseCanonicalAthleteRole,
  type AthleteRoleCode,
} from "@/lib/athlete-roles";
import {
  countActivePersonalGoals,
  MAX_ACTIVE_PERSONAL_GOALS,
  personalGoalStatusLabel,
  type PersonalGoalStatus,
} from "@/lib/athlete-personal-goals";
import {
  MAX_POSITIVE_COACH_TAGS,
  POSITIVE_COACH_TAG_LABEL,
  POSITIVE_COACH_TAGS,
  type PositiveCoachTagCode,
} from "@/lib/coach-note-tags";
import { athleteInitials } from "@/lib/parent-season";

type GoalRow = {
  id: string;
  text: string;
  status: PersonalGoalStatus;
};

type AthleteRosterEditorProps = {
  athletes: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
    shirtNumber: number | null;
    noteContent: string | null;
    positiveTags: PositiveCoachTagCode[];
    goals: GoalRow[];
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

function statusToneClass(status: PersonalGoalStatus): string {
  if (status === "ACHIEVED") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "CONTINUE") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

export function AthleteRosterEditor({ athletes, noteYear, noteMonth }: AthleteRosterEditorProps) {
  const [rows, setRows] = useState(athletes);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [draftGoal, setDraftGoal] = useState<Record<string, string>>({});

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

  function toggleTag(athleteId: string, tag: PositiveCoachTagCode) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== athleteId) return row;
        const has = row.positiveTags.includes(tag);
        if (has) {
          return { ...row, positiveTags: row.positiveTags.filter((item) => item !== tag) };
        }
        if (row.positiveTags.length >= MAX_POSITIVE_COACH_TAGS) return row;
        return { ...row, positiveTags: [...row.positiveTags, tag] };
      }),
    );
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
          positiveTags: row.positiveTags,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback((prev) => ({
          ...prev,
          [athleteId]: data?.error ?? "Salvataggio messaggio non riuscito.",
        }));
        return;
      }
      setFeedback((prev) => ({ ...prev, [athleteId]: "Messaggio salvato." }));
    } catch {
      setFeedback((prev) => ({ ...prev, [athleteId]: "Errore imprevisto." }));
    } finally {
      setPendingId(null);
    }
  }

  async function addGoal(athleteId: string) {
    const text = (draftGoal[athleteId] ?? "").trim();
    if (!text) {
      setFeedback((prev) => ({ ...prev, [athleteId]: "Scrivi un obiettivo." }));
      return;
    }

    setPendingId(athleteId);
    setFeedback((prev) => ({ ...prev, [athleteId]: "" }));
    try {
      const response = await fetch(`/api/mister/athletes/${athleteId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, status: "IN_PROGRESS" }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        goal?: GoalRow;
      } | null;
      if (!response.ok || !data?.goal) {
        setFeedback((prev) => ({
          ...prev,
          [athleteId]: data?.error ?? "Obiettivo non salvato.",
        }));
        return;
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === athleteId ? { ...row, goals: [data.goal!, ...row.goals] } : row,
        ),
      );
      setDraftGoal((prev) => ({ ...prev, [athleteId]: "" }));
      setFeedback((prev) => ({ ...prev, [athleteId]: "Obiettivo aggiunto." }));
    } catch {
      setFeedback((prev) => ({ ...prev, [athleteId]: "Errore imprevisto." }));
    } finally {
      setPendingId(null);
    }
  }

  async function updateGoalStatus(athleteId: string, goalId: string, status: PersonalGoalStatus) {
    setPendingId(athleteId);
    setFeedback((prev) => ({ ...prev, [athleteId]: "" }));
    try {
      const response = await fetch(`/api/mister/athletes/${athleteId}/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        goal?: GoalRow;
      } | null;
      if (!response.ok || !data?.goal) {
        setFeedback((prev) => ({
          ...prev,
          [athleteId]: data?.error ?? "Aggiornamento non riuscito.",
        }));
        return;
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === athleteId
            ? {
                ...row,
                goals: row.goals.map((goal) => (goal.id === goalId ? data.goal! : goal)),
              }
            : row,
        ),
      );
    } catch {
      setFeedback((prev) => ({ ...prev, [athleteId]: "Errore imprevisto." }));
    } finally {
      setPendingId(null);
    }
  }

  async function deleteGoal(athleteId: string, goalId: string) {
    setPendingId(athleteId);
    setFeedback((prev) => ({ ...prev, [athleteId]: "" }));
    try {
      const response = await fetch(`/api/mister/athletes/${athleteId}/goals/${goalId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback((prev) => ({
          ...prev,
          [athleteId]: data?.error ?? "Eliminazione non riuscita.",
        }));
        return;
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === athleteId
            ? { ...row, goals: row.goals.filter((goal) => goal.id !== goalId) }
            : row,
        ),
      );
      setFeedback((prev) => ({ ...prev, [athleteId]: "Obiettivo eliminato." }));
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
          Obiettivi personali e messaggio di {monthLabel} {noteYear} — solo per la famiglia
          dell&apos;atleta.
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
          const activeGoals = countActivePersonalGoals(athlete.goals);
          const canAddGoal = activeGoals < MAX_ACTIVE_PERSONAL_GOALS;

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
                    <span className="inline-flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" />
                      {activeGoals}/{MAX_ACTIVE_PERSONAL_GOALS} obiettivi
                    </span>
                  </p>
                  {!roleAssigned ? (
                    <span className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                      Ruolo da assegnare
                    </span>
                  ) : null}
                  {hasNote ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Messaggio {monthLabel.toLowerCase()}
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex text-[11px] font-semibold text-amber-700">
                      Messaggio da compilare
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

                  <div className="mt-5 rounded-2xl border border-blue-100 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-900">
                        Obiettivi personali
                      </p>
                      <span className="text-xs font-semibold text-zinc-600">
                        {activeGoals} di {MAX_ACTIVE_PERSONAL_GOALS} obiettivi attivi
                      </span>
                    </div>

                    <ul className="mt-3 space-y-2">
                      {athlete.goals.length === 0 ? (
                        <li className="text-sm text-zinc-600">Nessun obiettivo ancora.</li>
                      ) : (
                        athlete.goals.map((goal) => (
                          <li
                            key={goal.id}
                            className={`rounded-xl border px-3 py-3 ${statusToneClass(goal.status)}`}
                          >
                            <p className="text-sm font-semibold text-zinc-900">{goal.text}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-wide">
                              {personalGoalStatusLabel(goal.status)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {goal.status !== "ACHIEVED" ? (
                                <button
                                  type="button"
                                  disabled={pendingId === athlete.id}
                                  onClick={() =>
                                    updateGoalStatus(athlete.id, goal.id, "ACHIEVED")
                                  }
                                  className="min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-900"
                                >
                                  Raggiunto
                                </button>
                              ) : null}
                              {goal.status !== "CONTINUE" ? (
                                <button
                                  type="button"
                                  disabled={pendingId === athlete.id}
                                  onClick={() =>
                                    updateGoalStatus(athlete.id, goal.id, "CONTINUE")
                                  }
                                  className="min-h-11 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-950"
                                >
                                  Continua
                                </button>
                              ) : null}
                              {goal.status !== "IN_PROGRESS" ? (
                                <button
                                  type="button"
                                  disabled={pendingId === athlete.id}
                                  onClick={() =>
                                    updateGoalStatus(athlete.id, goal.id, "IN_PROGRESS")
                                  }
                                  className="min-h-11 rounded-xl border border-sky-300 bg-sky-50 px-3 text-xs font-bold text-sky-950"
                                >
                                  In corso
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={pendingId === athlete.id}
                                onClick={() => deleteGoal(athlete.id, goal.id)}
                                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-600"
                                aria-label="Elimina obiettivo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Elimina
                              </button>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>

                    {canAddGoal ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={draftGoal[athlete.id] ?? ""}
                          onChange={(event) =>
                            setDraftGoal((prev) => ({
                              ...prev,
                              [athlete.id]: event.target.value,
                            }))
                          }
                          maxLength={200}
                          placeholder="Es. Usa maggiormente il piede debole"
                          className="block min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                        />
                        <button
                          type="button"
                          disabled={pendingId === athlete.id}
                          onClick={() => addGoal(athlete.id)}
                          className="min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
                        >
                          Aggiungi obiettivo
                        </button>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-semibold text-amber-800">
                        Hai raggiunto il massimo di 3 obiettivi attivi. Segna come Raggiunto per
                        liberare uno spazio.
                      </p>
                    )}
                  </div>

                  <label className="mt-5 block text-xs font-medium text-zinc-700">
                    Messaggio di {monthLabel}
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
                      placeholder="Un messaggio personale per il ragazzo e la famiglia..."
                    />
                  </label>

                  <div className="mt-3">
                    <p className="text-xs font-medium text-zinc-700">
                      Tag positivi (max {MAX_POSITIVE_COACH_TAGS}, non sono voti)
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {POSITIVE_COACH_TAGS.map((tag) => {
                        const active = athlete.positiveTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(athlete.id, tag)}
                            className={`min-h-11 rounded-xl border px-3 text-xs font-bold uppercase tracking-wide ${
                              active
                                ? "border-blue-700 bg-blue-800 text-white"
                                : "border-zinc-200 bg-white text-zinc-700"
                            }`}
                          >
                            {POSITIVE_COACH_TAG_LABEL[tag]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={pendingId === athlete.id || !(athlete.noteContent ?? "").trim()}
                    onClick={() => saveNote(athlete.id)}
                    className="mt-3 min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    Salva messaggio
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
