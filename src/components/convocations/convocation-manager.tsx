"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConvocationResponseStatus } from "@prisma/client";
import {
  CONVOCATION_RESPONSE_BADGE_CLASS,
  CONVOCATION_RESPONSE_LABEL,
} from "@/lib/convocation-status";

type AthleteRow = {
  id: string;
  firstName: string;
  lastName: string;
  isSelected: boolean;
  responseStatus: ConvocationResponseStatus;
};

type ConvocationManagerProps = {
  eventId: string;
  eventTitle: string;
  eventCategoryName: string;
  eventDateLabel: string;
  initialNotes: string;
  athletes: AthleteRow[];
};

function buildSelectedMap(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, boolean>>((accumulator, athlete) => {
    accumulator[athlete.id] = athlete.isSelected;
    return accumulator;
  }, {});
}

function buildStatusMap(athletes: AthleteRow[]) {
  return athletes.reduce<Record<string, ConvocationResponseStatus>>((accumulator, athlete) => {
    accumulator[athlete.id] = athlete.responseStatus;
    return accumulator;
  }, {});
}

export function ConvocationManager({
  eventId,
  eventTitle,
  eventCategoryName,
  eventDateLabel,
  initialNotes,
  athletes,
}: ConvocationManagerProps) {
  const router = useRouter();
  const [selectedByAthlete, setSelectedByAthlete] = useState<Record<string, boolean>>(
    buildSelectedMap(athletes),
  );
  const [responseByAthlete] = useState<Record<string, ConvocationResponseStatus>>(
    buildStatusMap(athletes),
  );
  const [notes, setNotes] = useState(initialNotes);
  const [sendEmail, setSendEmail] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; ok?: string }>({});

  const selectedAthletes = useMemo(
    () => athletes.filter((athlete) => selectedByAthlete[athlete.id]),
    [athletes, selectedByAthlete],
  );

  const summary = useMemo(() => {
    const counts: Record<ConvocationResponseStatus, number> = {
      PENDING: 0,
      PRESENT: 0,
      ABSENT: 0,
    };

    for (const athlete of selectedAthletes) {
      const status = responseByAthlete[athlete.id] ?? "PENDING";
      counts[status] += 1;
    }

    return counts;
  }, [responseByAthlete, selectedAthletes]);

  async function saveConvocation() {
    setFeedback({});

    const athleteIds = selectedAthletes.map((athlete) => athlete.id);
    if (athleteIds.length === 0) {
      setFeedback({ error: "Seleziona almeno un atleta convocato." });
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/convocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          athleteIds,
          notes,
          sendEmail,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            emailSummary?: {
              attempted: boolean;
              totalRecipients: number;
              sentCount: number;
              failedCount: number;
              skippedReason?: string;
            };
          }
        | null;

      if (!response.ok) {
        setFeedback({ error: data?.error ?? "Salvataggio convocazione non riuscito." });
        setPending(false);
        return;
      }

      const emailSummary = data?.emailSummary;
      const okMessage =
        emailSummary?.attempted && emailSummary.skippedReason
          ? `Convocazione salvata. Email non inviate: ${emailSummary.skippedReason}`
          : emailSummary?.attempted
            ? `Convocazione salvata. Email inviate: ${emailSummary.sentCount}, fallite: ${emailSummary.failedCount}.`
            : "Convocazione salvata correttamente.";
      setFeedback({ ok: okMessage });
      setSendEmail(false);
      router.refresh();
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
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-center font-semibold text-blue-800">
          Convocati: {selectedAthletes.length}
        </span>
        <span
          className={`rounded-full px-2 py-1 text-center font-semibold ${CONVOCATION_RESPONSE_BADGE_CLASS.PRESENT}`}
        >
          Presenti: {summary.PRESENT}
        </span>
        <span
          className={`rounded-full px-2 py-1 text-center font-semibold ${CONVOCATION_RESPONSE_BADGE_CLASS.ABSENT}`}
        >
          Assenti: {summary.ABSENT}
        </span>
        <span
          className={`rounded-full px-2 py-1 text-center font-semibold ${CONVOCATION_RESPONSE_BADGE_CLASS.PENDING}`}
        >
          Senza risposta: {summary.PENDING}
        </span>
      </div>

      <label className="mt-4 block text-sm text-zinc-700">
        Note convocazione
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
        />
      </label>

      <ul className="mt-4 space-y-3">
        {athletes.map((athlete) => {
          const selected = selectedByAthlete[athlete.id] ?? false;
          const status = responseByAthlete[athlete.id] ?? "PENDING";
          return (
            <li key={athlete.id} className="rounded-lg border border-blue-100 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) =>
                      setSelectedByAthlete((prev) => ({
                        ...prev,
                        [athlete.id]: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
                  />
                  {athlete.firstName} {athlete.lastName}
                </label>
                <span
                  className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${CONVOCATION_RESPONSE_BADGE_CLASS[status]}`}
                >
                  {CONVOCATION_RESPONSE_LABEL[status]}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={(event) => setSendEmail(event.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
        />
        Invia convocazione ai genitori via email
      </label>

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
        onClick={saveConvocation}
        disabled={pending}
        className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Salvataggio..." : "Salva convocazione"}
      </button>
    </section>
  );
}
