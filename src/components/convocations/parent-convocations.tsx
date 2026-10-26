"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConvocationResponseStatus } from "@prisma/client";
import {
  CONVOCATION_RESPONSE_BADGE_CLASS,
  CONVOCATION_RESPONSE_LABEL,
} from "@/lib/convocation-status";

type ParentConvocationItem = {
  convocationAthleteId: string;
  athleteFullName: string;
  categoryName: string;
  eventTitle: string;
  meetingAtLabel: string;
  matchStartAtLabel: string;
  eventLocation: string | null;
  notes: string | null;
  responseStatus: ConvocationResponseStatus;
};

type ParentConvocationsProps = {
  items: ParentConvocationItem[];
};

export function ParentConvocations({ items }: ParentConvocationsProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { error?: string; ok?: string }>>({});

  async function saveResponse(convocationAthleteId: string, responseStatus: "PRESENT" | "ABSENT") {
    setPendingId(convocationAthleteId);
    setFeedback((prev) => ({ ...prev, [convocationAthleteId]: {} }));

    try {
      const response = await fetch(
        `/api/genitore/convocations/${convocationAthleteId}/response`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responseStatus }),
        },
      );

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setFeedback((prev) => ({
          ...prev,
          [convocationAthleteId]: {
            error: data?.error ?? "Salvataggio non riuscito.",
          },
        }));
        setPendingId(null);
        return;
      }

      const okText =
        responseStatus === "PRESENT"
          ? "Presenza confermata correttamente."
          : "Assenza confermata correttamente.";
      setFeedback((prev) => ({
        ...prev,
        [convocationAthleteId]: {
          ok: okText,
        },
      }));
      router.refresh();
    } catch {
      setFeedback((prev) => ({
        ...prev,
        [convocationAthleteId]: {
          error: "Errore imprevisto. Riprova.",
        },
      }));
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-zinc-700">
        Nessuna convocazione ricevuta.
      </p>
    );
  }

  const openItems = items.filter((item) => item.responseStatus === "PENDING");
  const answeredItems = items.filter((item) => item.responseStatus !== "PENDING");

  function renderItem(item: ParentConvocationItem, allowEditsHint: boolean) {
    const itemFeedback = feedback[item.convocationAthleteId] ?? {};
    const isPending = pendingId === item.convocationAthleteId;
    const isUnanswered = item.responseStatus === "PENDING";

    return (
      <article
        key={item.convocationAthleteId}
        className={[
          "rounded-3xl border bg-white p-4 shadow-sm transition",
          isUnanswered
            ? "border-sky-300 bg-gradient-to-br from-sky-50 to-white ring-1 ring-sky-200"
            : "border-blue-100",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-zinc-900">{item.athleteFullName}</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-500">{item.categoryName}</p>
          </div>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
              isUnanswered
                ? "border-sky-300 bg-sky-100 text-sky-950"
                : CONVOCATION_RESPONSE_BADGE_CLASS[item.responseStatus]
            }`}
          >
            {CONVOCATION_RESPONSE_LABEL[item.responseStatus]}
          </span>
        </div>
        <p className="mt-3 text-lg font-black tracking-tight text-zinc-900">{item.eventTitle}</p>
        <div className="mt-2 space-y-1 text-sm text-zinc-600">
          <p>Convocazione: {item.meetingAtLabel}</p>
          <p>Partita: {item.matchStartAtLabel}</p>
          <p>Luogo: {item.eventLocation || "-"}</p>
        </div>
        {item.notes ? <p className="mt-2 text-sm text-zinc-600">Note: {item.notes}</p> : null}
        {isUnanswered ? (
          <p className="mt-3 rounded-2xl border border-sky-200 bg-sky-100/70 px-3 py-2.5 text-xs font-bold text-sky-950">
            In attesa di risposta: conferma ora per aiutare lo staff a organizzare l&apos;evento.
          </p>
        ) : null}
        {allowEditsHint ? (
          <p className="mt-2 text-xs text-zinc-500">
            Se serve, puoi aggiornare la risposta con i pulsanti qui sotto.
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => saveResponse(item.convocationAthleteId, "PRESENT")}
            disabled={isPending}
            className="min-h-12 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            Conferma presenza
          </button>
          <button
            type="button"
            onClick={() => saveResponse(item.convocationAthleteId, "ABSENT")}
            disabled={isPending}
            className="min-h-12 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
          >
            Comunica indisponibilità
          </button>
        </div>

        {itemFeedback.error ? (
          <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {itemFeedback.error}
          </p>
        ) : null}
        {itemFeedback.ok ? (
          <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            {itemFeedback.ok}
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      {openItems.length > 0 ? (
        <p className="rounded-2xl border border-sky-300 bg-sky-100 px-4 py-3 text-sm font-bold text-sky-950 shadow-sm">
          Hai {openItems.length} convocazioni ancora da confermare.
        </p>
      ) : null}

      <p className="text-sm text-zinc-700">
        Conferma se tuo figlio sarà presente all&apos;evento.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <p className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-bold text-sky-900">
          Da confermare: {openItems.length}
        </p>
        <p className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-900">
          Già risposte: {answeredItems.length}
        </p>
      </div>

      {openItems.length > 0 ? (
        <section>
          <h5 className="text-xs font-bold uppercase tracking-wide text-sky-800">
            Da confermare
          </h5>
          <div className="mt-2 space-y-3">{openItems.map((item) => renderItem(item, false))}</div>
        </section>
      ) : null}

      {answeredItems.length > 0 ? (
        <section>
          <h5 className="text-xs font-bold uppercase tracking-wide text-blue-800">
            Già risposte
          </h5>
          <div className="mt-2 space-y-3">
            {answeredItems.map((item) => renderItem(item, true))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
