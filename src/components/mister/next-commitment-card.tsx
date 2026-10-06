import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  MapPin,
  Megaphone,
} from "lucide-react";
import {
  formatConvocationWallClockDate,
  formatConvocationWallClockTime,
} from "@/lib/convocation-times";
import { formatEventType } from "@/lib/events";
import { isMatchEventType } from "@/lib/parent-season";
import {
  resolveMatchDayOpponentName,
  resolveMatchDayPhase,
  type MatchDayPhase,
} from "@/lib/match-day";

export type NextCommitmentData = {
  id: string;
  title: string;
  type: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  opponentName: string | null;
  isHome: boolean | null;
  categoryName: string | null;
  isToday: boolean;
  hasConvocation: boolean;
  convocationNotes: string | null;
  hasTrainingSession?: boolean;
  hasFormation?: boolean;
};

function phaseLabel(phase: MatchDayPhase) {
  if (phase === "LIVE") return "IN CORSO";
  if (phase === "FULL_TIME") return "TERMINATA";
  return "IN PROGRAMMA";
}

export function NextCommitmentCard({
  event,
  wallNow,
}: {
  event: NextCommitmentData | null;
  wallNow: Date;
}) {
  if (!event) {
    return (
      <section className="rounded-2xl border border-dashed border-blue-200 bg-white/80 p-5 text-sm text-zinc-600 shadow-sm">
        Nessun impegno in programma. Controlla il calendario per creare o verificare gli eventi.
      </section>
    );
  }

  const match = isMatchEventType(event.type);
  const opponent = resolveMatchDayOpponentName({
    opponentName: event.opponentName,
    title: event.title,
  });
  const phase = match
    ? resolveMatchDayPhase({ startAt: event.startAt, endAt: event.endAt, wallNow })
    : null;
  const venue =
    event.isHome === true ? "Casa" : event.isHome === false ? "Trasferta" : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-700 bg-blue-800 text-white shadow-md">
      <div className="relative p-5 sm:p-6">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-400/10" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
            {event.isToday ? "Oggi" : "Prossimo impegno"}
          </span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
            {formatEventType(event.type as never)}
          </span>
          {phase ? (
            <span className="rounded-full border border-emerald-300/40 bg-emerald-400/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-100">
              {phaseLabel(phase)}
            </span>
          ) : null}
        </div>

        <h2 className="relative mt-4 text-2xl font-black tracking-tight sm:text-3xl">
          {match ? (
            <>
              Comun Nuovo{" "}
              <span className="text-sky-200">vs</span> {opponent}
            </>
          ) : (
            event.title
          )}
        </h2>

        <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-sky-100">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {formatConvocationWallClockDate(event.startAt)} ·{" "}
            {formatConvocationWallClockTime(event.startAt)}
          </span>
          {event.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {event.location}
            </span>
          ) : null}
          {venue ? <span className="font-semibold text-white">{venue}</span> : null}
          {event.categoryName ? (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold">
              {event.categoryName}
            </span>
          ) : null}
        </div>

        {event.hasConvocation ? (
          <p className="relative mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-100">
            <Megaphone className="h-3.5 w-3.5" />
            Convocazione presente
            {event.convocationNotes ? " · note per le famiglie" : ""}
          </p>
        ) : null}

        <div className="relative mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href={`/mister/eventi/${event.id}/presenze`}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold uppercase tracking-wide text-blue-900 shadow-sm hover:bg-sky-50"
          >
            {match ? "Gestisci partita" : "Registra presenze"}
          </Link>
          {event.hasConvocation || match ? (
            <Link
              href={`/mister/eventi/${event.id}/convocazioni`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Convocazione
            </Link>
          ) : null}
          {!match && event.type === "TRAINING" ? (
            <Link
              href={`/mister/eventi/${event.id}/allenamento`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15"
            >
              {event.hasTrainingSession ? "Modifica seduta" : "Prepara seduta"}
            </Link>
          ) : null}
          {match ? (
            <Link
              href={`/mister/eventi/${event.id}/formazione`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15"
            >
              Formazione
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
