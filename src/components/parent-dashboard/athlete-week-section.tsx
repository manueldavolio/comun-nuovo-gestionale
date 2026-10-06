import {
  formatConvocationWallClockTime,
} from "@/lib/convocation-times";
import {
  CONVOCATION_RESPONSE_LABEL,
} from "@/lib/convocation-status";
import type { ConvocationResponseStatus } from "@prisma/client";
import {
  formatWeekEventDateLabel,
  type WeekEventRow,
  type WeekTrainingSummary,
} from "@/lib/my-comun-nuovo/week";
import { resolveMatchDayOpponentName } from "@/lib/match-day";

type AthleteWeekSectionProps = {
  athleteFirstName: string;
  rows: WeekEventRow[];
  trainingSummary: WeekTrainingSummary;
  weekCompleted?: boolean;
};

export function AthleteWeekSection({
  athleteFirstName,
  rows,
  trainingSummary,
  weekCompleted = false,
}: AthleteWeekSectionProps) {
  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
            La settimana di {athleteFirstName}
          </p>
          <p className="mt-1 text-sm text-zinc-600">Lunedì → domenica · Comun Nuovo</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {weekCompleted ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-950">
              Settimana completata
            </span>
          ) : null}
          {trainingSummary.label ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
              {trainingSummary.label}
            </span>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">Nessun impegno questa settimana.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((row) => {
            const time = formatConvocationWallClockTime(row.startAt);
            const matchTitle = row.isMatch
              ? `Comun Nuovo · ${row.opponentLabel ?? resolveMatchDayOpponentName({ opponentName: null, title: row.title })}`
              : row.typeLabel;

            return (
              <li
                key={row.id}
                className="rounded-2xl border border-sky-100 bg-sky-50/60 px-3 py-3 sm:px-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-[4.5rem] shrink-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-blue-800">
                      {formatWeekEventDateLabel(row.startAt)}
                    </p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{time}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                      {row.isMatch ? "Partita" : row.typeLabel}
                    </p>
                    <p className="truncate text-sm font-semibold text-zinc-900">{matchTitle}</p>
                    {row.isMatch && row.meetingAt ? (
                      <p className="mt-0.5 text-xs text-zinc-600">
                        Convocazione {formatConvocationWallClockTime(row.meetingAt)}
                      </p>
                    ) : null}
                    {row.isPast && row.attendanceStatus === "PRESENT" ? (
                      <p className="mt-1 text-xs font-semibold text-emerald-700">✓ Presente</p>
                    ) : null}
                    {row.isPast &&
                    row.attendanceStatus != null &&
                    row.attendanceStatus !== "PRESENT" ? (
                      <p className="mt-1 text-xs font-semibold text-zinc-500">— Assente</p>
                    ) : null}
                    {!row.isPast && row.isMatch && row.isConvoked ? (
                      <p className="mt-1 text-xs font-semibold text-blue-800">
                        Convocato
                        {row.convocationResponse
                          ? ` · ${
                              CONVOCATION_RESPONSE_LABEL[
                                row.convocationResponse as ConvocationResponseStatus
                              ] ?? row.convocationResponse
                            }`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
