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
  eventStartAtLabel: string;
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
      <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
        Nessuna convocazione ricevuta.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {items.map((item) => {
        const itemFeedback = feedback[item.convocationAthleteId] ?? {};
        const isPending = pendingId === item.convocationAthleteId;
        return (
          <article key={item.convocationAthleteId} className="rounded-lg border border-blue-100 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900">{item.athleteFullName}</p>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${CONVOCATION_RESPONSE_BADGE_CLASS[item.responseStatus]}`}
              >
                {CONVOCATION_RESPONSE_LABEL[item.responseStatus]}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-700">{item.eventTitle}</p>
            <p className="text-xs text-zinc-600">
              {item.categoryName} - {item.eventStartAtLabel}
            </p>
            <p className="text-xs text-zinc-600">Luogo: {item.eventLocation || "-"}</p>
            {item.notes ? <p className="mt-1 text-xs text-zinc-600">Note: {item.notes}</p> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveResponse(item.convocationAthleteId, "PRESENT")}
                disabled={isPending}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
              >
                Presente
              </button>
              <button
                type="button"
                onClick={() => saveResponse(item.convocationAthleteId, "ABSENT")}
                disabled={isPending}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                Assente
              </button>
            </div>

            {itemFeedback.error ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {itemFeedback.error}
              </p>
            ) : null}
            {itemFeedback.ok ? (
              <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {itemFeedback.ok}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
