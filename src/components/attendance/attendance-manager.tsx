"use client";

import { useMemo, useState } from "react";
import type { AttendanceStatus } from "@prisma/client";
import { ATTENDANCE_STATUS_CHOICES, ATTENDANCE_STATUS_LABEL } from "@/lib/attendance-status";

type AthleteRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus;
  goals?: number;
  assists?: number;
};

type MatchResultState = {
  opponentName: string;
  homeScore: string;
  awayScore: string;
  isHome: boolean;
};

type AttendanceManagerProps = {
  eventId: string;
  eventTitle: string;
  eventCategoryName: string;
  eventDateLabel: string;
  athletes: AthleteRow[];
  matchMode?: boolean;
  initialMatchResult?: {
    opponentName: string | null;
    homeScore: number | null;
    awayScore: number | null;
    isHome: boolean | null;
  };
};

function buildInitialStatus(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, AttendanceStatus>>((accumulator, athlete) => {
    accumulator[athlete.id] = athlete.status;
    return accumulator;
  }, {});
}

function buildInitialGoals(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, number>>((accumulator, athlete) => {
    accumulator[athlete.id] = athlete.goals ?? 0;
    return accumulator;
  }, {});
}

function buildInitialAssists(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, number>>((accumulator, athlete) => {
    accumulator[athlete.id] = athlete.assists ?? 0;
    return accumulator;
  }, {});
}

const BADGE_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800",
  ABSENT: "bg-red-100 text-red-800",
  JUSTIFIED_ABSENCE: "bg-amber-100 text-amber-800",
  INJURED: "bg-slate-200 text-slate-800",
};

export function AttendanceManager({
  eventId,
  eventTitle,
  eventCategoryName,
  eventDateLabel,
  athletes,
  matchMode = false,
  initialMatchResult,
}: AttendanceManagerProps) {
  const [statusByAthlete, setStatusByAthlete] = useState<Record<string, AttendanceStatus>>(
    buildInitialStatus(athletes),
  );
  const [goalsByAthlete, setGoalsByAthlete] = useState<Record<string, number>>(
    buildInitialGoals(athletes),
  );
  const [assistsByAthlete, setAssistsByAthlete] = useState<Record<string, number>>(
    buildInitialAssists(athletes),
  );
  const [matchResult, setMatchResult] = useState<MatchResultState>({
    opponentName: initialMatchResult?.opponentName ?? "",
    homeScore:
      initialMatchResult?.homeScore == null ? "" : String(initialMatchResult.homeScore),
    awayScore:
      initialMatchResult?.awayScore == null ? "" : String(initialMatchResult.awayScore),
    isHome: initialMatchResult?.isHome ?? true,
  });
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; ok?: string }>({});

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      JUSTIFIED_ABSENCE: 0,
      INJURED: 0,
    };

    for (const athlete of athletes) {
      counts[statusByAthlete[athlete.id] ?? "PRESENT"] += 1;
    }

    return counts;
  }, [athletes, statusByAthlete]);

  function setStatus(athleteId: string, status: AttendanceStatus) {
    setStatusByAthlete((prev) => ({ ...prev, [athleteId]: status }));
    if (status !== "PRESENT") {
      setGoalsByAthlete((prev) => ({ ...prev, [athleteId]: 0 }));
      setAssistsByAthlete((prev) => ({ ...prev, [athleteId]: 0 }));
    }
  }

  async function saveAttendance() {
    setPending(true);
    setFeedback({});

    try {
      const entries = athletes.map((athlete) => {
        const status = statusByAthlete[athlete.id] ?? "PRESENT";
        const present = status === "PRESENT";
        return {
          athleteId: athlete.id,
          status,
          ...(matchMode
            ? {
                goals: present ? (goalsByAthlete[athlete.id] ?? 0) : 0,
                assists: present ? (assistsByAthlete[athlete.id] ?? 0) : 0,
              }
            : {}),
        };
      });

      const body: Record<string, unknown> = { entries };

      if (matchMode) {
        const homeScore =
          matchResult.homeScore.trim() === ""
            ? null
            : Number.parseInt(matchResult.homeScore, 10);
        const awayScore =
          matchResult.awayScore.trim() === ""
            ? null
            : Number.parseInt(matchResult.awayScore, 10);

        if (
          (homeScore != null && Number.isNaN(homeScore)) ||
          (awayScore != null && Number.isNaN(awayScore))
        ) {
          setFeedback({ error: "Punteggio non valido." });
          setPending(false);
          return;
        }

        body.matchResult = {
          opponentName: matchResult.opponentName.trim() || null,
          homeScore,
          awayScore,
          isHome: matchResult.isHome,
        };
      }

      const response = await fetch(`/api/events/${eventId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; updated?: number }
        | null;

      if (!response.ok) {
        setFeedback({ error: data?.error ?? "Salvataggio non riuscito." });
        setPending(false);
        return;
      }

      setFeedback({
        ok: matchMode
          ? `Presenze e statistiche salvate (${data?.updated ?? entries.length}).`
          : `Presenze salvate (${data?.updated ?? entries.length}).`,
      });
    } catch {
      setFeedback({ error: "Errore imprevisto. Riprova." });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-zinc-900">{eventTitle}</h2>
        <p className="text-sm text-zinc-600">{eventCategoryName}</p>
        <p className="text-sm text-zinc-600">{eventDateLabel}</p>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        {ATTENDANCE_STATUS_CHOICES.map((choice) => (
          <span
            key={choice.value}
            className={`rounded-full px-2 py-1 text-center font-semibold ${BADGE_CLASS[choice.value]}`}
          >
            {choice.label}: {summary[choice.value]}
          </span>
        ))}
      </div>

      {matchMode ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-sky-100 bg-sky-50/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-zinc-700 sm:col-span-2">
            Avversario
            <input
              value={matchResult.opponentName}
              onChange={(event) =>
                setMatchResult((prev) => ({ ...prev, opponentName: event.target.value }))
              }
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="Es. Paladina"
            />
          </label>
          <label className="text-sm text-zinc-700">
            Gol casa
            <input
              type="number"
              min={0}
              max={99}
              value={matchResult.homeScore}
              onChange={(event) =>
                setMatchResult((prev) => ({ ...prev, homeScore: event.target.value }))
              }
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
          </label>
          <label className="text-sm text-zinc-700">
            Gol trasferta
            <input
              type="number"
              min={0}
              max={99}
              value={matchResult.awayScore}
              onChange={(event) =>
                setMatchResult((prev) => ({ ...prev, awayScore: event.target.value }))
              }
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
            <input
              type="checkbox"
              checked={matchResult.isHome}
              onChange={(event) =>
                setMatchResult((prev) => ({ ...prev, isHome: event.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            Comun Nuovo in casa
          </label>
        </div>
      ) : null}

      {matchMode ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-blue-100 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                <th className="px-2 py-2 font-semibold">Atleta</th>
                <th className="px-2 py-2 font-semibold">Presenza</th>
                <th className="px-2 py-2 font-semibold">Gol</th>
                <th className="px-2 py-2 font-semibold">Assist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {athletes.map((athlete) => {
                const status = statusByAthlete[athlete.id] ?? "PRESENT";
                const present = status === "PRESENT";
                return (
                  <tr key={athlete.id}>
                    <td className="px-2 py-2">
                      <p className="font-semibold text-zinc-900">
                        {athlete.firstName} {athlete.lastName}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_CLASS[status]}`}
                      >
                        {ATTENDANCE_STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={status}
                        onChange={(event) =>
                          setStatus(athlete.id, event.target.value as AttendanceStatus)
                        }
                        className="block w-full min-w-36 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none ring-blue-500 focus:ring-2"
                      >
                        {ATTENDANCE_STATUS_CHOICES.map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        disabled={!present}
                        value={goalsByAthlete[athlete.id] ?? 0}
                        onChange={(event) =>
                          setGoalsByAthlete((prev) => ({
                            ...prev,
                            [athlete.id]: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                          }))
                        }
                        className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none ring-blue-500 focus:ring-2 disabled:bg-zinc-100 disabled:text-zinc-400"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        disabled={!present}
                        value={assistsByAthlete[athlete.id] ?? 0}
                        onChange={(event) =>
                          setAssistsByAthlete((prev) => ({
                            ...prev,
                            [athlete.id]: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                          }))
                        }
                        className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none ring-blue-500 focus:ring-2 disabled:bg-zinc-100 disabled:text-zinc-400"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {athletes.map((athlete) => {
            const status = statusByAthlete[athlete.id] ?? "PRESENT";

            return (
              <li key={athlete.id} className="rounded-lg border border-blue-100 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {athlete.firstName} {athlete.lastName}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_CLASS[status]}`}
                    >
                      {ATTENDANCE_STATUS_LABEL[status]}
                    </span>
                  </div>

                  <label className="text-sm text-zinc-700">
                    Stato presenza
                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(athlete.id, event.target.value as AttendanceStatus)
                      }
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 sm:w-52"
                    >
                      {ATTENDANCE_STATUS_CHOICES.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {feedback.error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {feedback.error}
        </p>
      ) : null}
      {feedback.ok ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {feedback.ok}
        </p>
      ) : null}

      <button
        type="button"
        onClick={saveAttendance}
        disabled={pending || athletes.length === 0}
        className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Salvataggio..." : matchMode ? "Salva" : "Salva presenze"}
      </button>
    </section>
  );
}
