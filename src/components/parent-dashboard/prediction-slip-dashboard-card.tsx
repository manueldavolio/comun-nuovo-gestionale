import Link from "next/link";
import type { EntryEvaluation } from "@/lib/prediction-slip";

type PredictionSlipDashboardCardProps = {
  slipId: string;
  title: string;
  prizeText: string;
  eventsCount: number;
  lockState: "OPEN" | "LOCKED";
  effectiveClosesAtLabel: string;
  hasEntry: boolean;
  evaluation: EntryEvaluation | null;
};

export function PredictionSlipDashboardCard({
  slipId,
  title,
  prizeText,
  eventsCount,
  lockState,
  effectiveClosesAtLabel,
  hasEntry,
  evaluation,
}: PredictionSlipDashboardCardProps) {
  const href = `/genitore/schedina/${slipId}`;

  let body: React.ReactNode;
  let cta = "Vedi la tua schedina";

  if (lockState === "OPEN" && !hasEntry) {
    body = (
      <>
        <p className="text-sm text-blue-950">
          {eventsCount} partite · Chiude {effectiveClosesAtLabel}
        </p>
        <p className="mt-1 text-sm text-amber-900">In palio: {prizeText}</p>
      </>
    );
    cta = "Compila la schedina";
  } else if (lockState === "OPEN" && hasEntry) {
    body = (
      <>
        <p className="text-sm font-semibold text-emerald-800">Schedina inviata</p>
        <p className="text-sm text-zinc-700">Puoi modificarla fino a {effectiveClosesAtLabel}</p>
      </>
    );
    cta = "Vedi / Modifica";
  } else if (lockState === "LOCKED" && hasEntry && evaluation?.perfect) {
    body = (
      <>
        <p className="text-base font-bold text-emerald-800">SCHEDINA PERFETTA!</p>
        <p className="text-sm text-emerald-700">
          {evaluation.correct}/{evaluation.total}
        </p>
      </>
    );
  } else if (lockState === "LOCKED" && hasEntry && evaluation) {
    body = (
      <p className="text-sm font-semibold text-zinc-800">
        {evaluation.correct}/{evaluation.total} corretti
        {evaluation.pending > 0 ? ` · ${evaluation.pending} in attesa` : ""}
      </p>
    );
  } else {
    body = <p className="text-sm text-zinc-700">Pronostici chiusi</p>;
    cta = hasEntry ? "Vedi la tua schedina" : "Vedi dettagli";
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-sky-50 to-blue-100 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
        Schedina Comun Nuovo
      </p>
      <h2 className="mt-1 text-lg font-bold text-zinc-900">{title}</h2>
      <div className="mt-2 space-y-1">{body}</div>
      <Link
        href={href}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
      >
        {cta}
      </Link>
    </section>
  );
}
