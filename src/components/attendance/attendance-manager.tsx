"use client";

import { useMemo, useState } from "react";
import type { AttendanceStatus } from "@/generated/prisma/enums";
import { ATTENDANCE_STATUS_CHOICES, ATTENDANCE_STATUS_LABEL } from "@/lib/attendance-status";

type AthleteRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus;
};

type AttendanceManagerProps = {
  eventId: string;
  eventTitle: string;
  eventCategoryName: string;
  eventDateLabel: string;
  athletes: AthleteRow[];
};

function buildInitialState(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, AttendanceStatus>>((accumulator, athlete) => {
    accumulator[athlete.id] = athlete.status;
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
}: AttendanceManagerProps) {
  const [statusByAthlete, setStatusByAthlete] = useState<Record<string, AttendanceStatus>>(
    buildInitialState(athletes),
  );
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

  async function saveAttendance() {
    setPending(true);
    setFeedback({});

    try {
      const entries = athletes.map((athlete) => ({
        athleteId: athlete.id,
        status: statusByAthlete[athlete.id] ?? "PRESENT",
      }));

      const response = await fetch(`/api/events/${eventId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; updated?: number }
        | null;

      if (!response.ok) {
        setFeedback({ error: data?.error ?? "Salvataggio non riuscito." });
        setPending(false);
        return;
      }

      setFeedback({ ok: `Presenze salvate (${data?.updated ?? entries.length}).` });
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
                      setStatusByAthlete((prev) => ({
                        ...prev,
                        [athlete.id]: event.target.value as AttendanceStatus,
                      }))
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
        {pending ? "Salvataggio..." : "Salva presenze"}
      </button>
    </section>
  );
}
