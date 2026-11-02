import Link from "next/link";
import {
  PARTICIPATION_CAN_LABEL,
  PARTICIPATION_CANNOT_LABEL,
} from "@/lib/health-data-access";

export type ParticipationSummary = {
  total: number;
  canParticipate: number;
  cannotParticipate: number;
};

export function MisterAvailabilitySummaryCard({
  summary,
}: {
  summary: ParticipationSummary;
}) {
  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
            Partecipazione
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Solo operativo · nessuna informazione sanitaria
          </p>
        </div>
        <Link
          href="/mister/squadra"
          className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-sky-50 px-3 text-xs font-bold text-blue-900"
        >
          Vedi rosa
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-center">
          <p className="text-2xl font-black tabular-nums text-emerald-900">
            {summary.canParticipate}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
            {PARTICIPATION_CAN_LABEL}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
          <p className="text-2xl font-black tabular-nums text-slate-800">
            {summary.cannotParticipate}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
            {PARTICIPATION_CANNOT_LABEL}
          </p>
        </div>
      </div>
    </section>
  );
}
