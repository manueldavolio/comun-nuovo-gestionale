"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ReminderSummary = {
  totalTargets: number;
  expiringTargets: number;
  expiredTargets: number;
  sent: number;
  skipped: number;
  failed: number;
  mailDisabledReason?: string;
};

type AdminMedicalVisitRemindersActionsProps = {
  expiringCount: number;
  expiredCount: number;
};

export function AdminMedicalVisitRemindersActions({
  expiringCount,
  expiredCount,
}: AdminMedicalVisitRemindersActionsProps) {
  const router = useRouter();
  const total = expiringCount + expiredCount;

  const disabled = useMemo(() => total === 0, [total]);

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ ok?: boolean; error?: string; summary?: ReminderSummary }>(
    {},
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/medical-visits/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeExpiring: true, includeExpired: true }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean; summary?: ReminderSummary }
        | null;

      if (!response.ok) {
        setStatus({ error: data?.error ?? "Invio non riuscito." });
        return;
      }

      if (!data?.summary) {
        setStatus({ error: "Risposta non valida dal server." });
        return;
      }

      setStatus({ ok: true, summary: data.summary });
      router.refresh();
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Errore imprevisto. Riprova." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-start gap-2 md:w-auto md:items-end">
      <form onSubmit={submit}>
        <button
          type="submit"
          disabled={submitting || disabled}
          className="inline-flex items-center rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
        >
          {submitting ? "Invio in corso..." : "Invia promemoria visite"}
        </button>
      </form>

      {status.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {status.error}
        </p>
      ) : null}

      {status.ok && status.summary ? (
        <div className="space-y-1 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <p>
            Inviate: <span className="font-semibold">{status.summary.sent}</span>
          </p>
          <p>
            Fallite: <span className="font-semibold">{status.summary.failed}</span>
          </p>
          <p>
            Saltate: <span className="font-semibold">{status.summary.skipped}</span>
          </p>
          {status.summary.mailDisabledReason ? (
            <p className="text-xs text-blue-800">
              Nota: configurazione mail non completa. {status.summary.mailDisabledReason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

