import Link from "next/link";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { formatConvocationWallClockDate } from "@/lib/convocation-times";
import { resolveMatchDayOpponentName } from "@/lib/match-day";
import type { IncompleteMatchRow } from "@/lib/mister-incomplete";

const REASON_LABEL: Record<string, string> = {
  MISSING_ATTENDANCE: "Presenze mancanti",
  MISSING_RESULT: "Risultato mancante",
};

export function IncompleteMatchesPanel({ matches }: { matches: IncompleteMatchRow[] }) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <CircleAlert className="h-5 w-5 text-red-600" />
        <h2 className="text-lg font-bold text-zinc-900">Da completare</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Partite recenti ancora senza appello o risultato.
      </p>

      <ul className="mt-4 space-y-3">
        {matches.map((match) => {
          const opponent = resolveMatchDayOpponentName({
            opponentName: match.opponentName,
            title: match.title,
          });
          return (
            <li
              key={match.id}
              className="rounded-2xl border border-red-100 bg-red-50/60 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-zinc-900">
                    Comun Nuovo <span className="text-zinc-400">-</span> {opponent}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-600">
                    {formatConvocationWallClockDate(match.startAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {match.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border border-red-200 bg-white px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-700"
                      >
                        {REASON_LABEL[reason] ?? reason}
                      </span>
                    ))}
                    {typeof match.periodsEntered === "number" &&
                    typeof match.periodsTotal === "number" &&
                    match.reasons.includes("MISSING_RESULT") ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                        {match.periodsEntered}/{match.periodsTotal} tempi inseriti
                      </span>
                    ) : null}
                    {match.softStatsHint ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                        <AlertTriangle className="h-3 w-3" />
                        Verifica gol/assist
                      </span>
                    ) : null}
                  </div>
                </div>
                <Link
                  href={`/mister/eventi/${match.id}/presenze`}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-700"
                >
                  Completa partita
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
