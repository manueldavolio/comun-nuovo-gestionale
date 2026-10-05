import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  ExternalLink,
  StickyNote,
} from "lucide-react";
import {
  formatConvocationWallClockDate,
  formatConvocationWallClockTime,
} from "@/lib/convocation-times";
import {
  CONVOCATION_RESPONSE_BADGE_CLASS,
  CONVOCATION_RESPONSE_LABEL,
} from "@/lib/convocation-status";
import type { ConvocationResponseStatus } from "@prisma/client";
import {
  buildGoogleMapsSearchUrl,
  matchDayScoreLines,
  matchDayTeamLayout,
  resolveConvocationNote,
  resolveMatchDayOpponentName,
  resolveMatchDaySecondaryLabel,
  type MatchDayPhase,
} from "@/lib/match-day";

type MatchDayCardProps = {
  phase: MatchDayPhase;
  title: string;
  opponentName: string | null;
  isHome: boolean | null;
  startAt: Date;
  location: string | null;
  meetingAt: Date | null;
  isConvoked: boolean;
  responseStatus: ConvocationResponseStatus | null;
  convocationNotes: string | null;
  homeScore: number | null;
  awayScore: number | null;
  playerGoals: number;
  playerAssists: number;
  /** Se noto: presenza reale Match Center. */
  playerPresent?: boolean | null;
  /** Dettaglio tempi Pulcini/Esordienti, es. "1-0 · 1-0 · 1-0 · 0-10". */
  periodScoresDetail?: string | null;
};

export function MatchDayCard({
  phase,
  title,
  opponentName,
  isHome,
  startAt,
  location,
  meetingAt,
  isConvoked,
  responseStatus,
  convocationNotes,
  homeScore,
  awayScore,
  playerGoals,
  playerAssists,
  playerPresent = null,
  periodScoresDetail = null,
}: MatchDayCardProps) {
  const resolvedOpponent = resolveMatchDayOpponentName({ opponentName, title });
  const secondaryLabel = resolveMatchDaySecondaryLabel({
    title,
    resolvedOpponent,
  });
  const note = resolveConvocationNote(convocationNotes);
  const teams = matchDayTeamLayout({ opponentName: resolvedOpponent, isHome });
  const mapsUrl = buildGoogleMapsSearchUrl(location);
  const hasResult = homeScore != null && awayScore != null;
  const score = hasResult
    ? matchDayScoreLines({
        opponentName: resolvedOpponent,
        isHome,
        homeScore: homeScore!,
        awayScore: awayScore!,
      })
    : null;

  const phaseBadge =
    phase === "PRE_MATCH"
      ? { label: "OGGI SI GIOCA", className: "bg-sky-400/20 text-sky-100" }
      : phase === "LIVE"
        ? { label: "PARTITA IN CORSO", className: "bg-amber-400/20 text-amber-100" }
        : hasResult
          ? { label: "FULL TIME", className: "bg-white/20 text-white" }
          : { label: "PARTITA TERMINATA", className: "bg-white/15 text-sky-100" };

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-700 bg-blue-800 text-white shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">Match Day</p>
          <p className="text-base font-black tracking-tight sm:text-lg">{phaseBadge.label}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${phaseBadge.className}`}
        >
          {formatConvocationWallClockDate(startAt)}
        </span>
      </div>

      <div className="relative px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="absolute -right-8 top-0 h-28 w-28 rounded-full bg-sky-400/10" aria-hidden />

        {phase === "FULL_TIME" && score ? (
          <>
            <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
              <div className="min-w-0 text-right">
                <p className="truncate text-xs font-bold uppercase tracking-wide text-sky-100 sm:text-sm">
                  {score.leftName}
                </p>
                <p className="text-3xl font-black tabular-nums sm:text-4xl">{score.leftScore}</p>
              </div>
              <p className="text-xs font-bold text-sky-200">FT</p>
              <div className="min-w-0 text-left">
                <p className="truncate text-xs font-bold uppercase tracking-wide text-sky-100 sm:text-sm">
                  {score.rightName}
                </p>
                <p className="text-3xl font-black tabular-nums sm:text-4xl">{score.rightScore}</p>
              </div>
            </div>
            {periodScoresDetail ? (
              <p className="relative mt-2 text-center text-[11px] font-medium text-sky-200/90">
                Tempi: {periodScoresDetail}
              </p>
            ) : null}
          </>
        ) : (
          <div className="relative space-y-1.5">
            <div className="grid grid-cols-1 items-center gap-1 md:grid-cols-[1fr_auto_1fr] md:gap-3">
              <p className="truncate text-center text-xl font-black uppercase tracking-tight md:text-right md:text-2xl lg:text-[1.65rem]">
                {teams.topName}
              </p>
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.24em] text-sky-200">
                vs
              </p>
              <p className="truncate text-center text-xl font-black uppercase tracking-tight md:text-left md:text-2xl lg:text-[1.65rem]">
                {teams.bottomName}
              </p>
            </div>
            {secondaryLabel ? (
              <p className="text-center text-[11px] font-medium text-sky-200/90">{secondaryLabel}</p>
            ) : null}
            {phase === "FULL_TIME" && !hasResult ? (
              <p className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-center text-xs text-sky-100">
                Risultato non ancora disponibile
              </p>
            ) : null}
          </div>
        )}

        {phase !== "FULL_TIME" || !hasResult ? (
          <div className="relative mt-3 grid gap-1.5 sm:grid-cols-3">
            {meetingAt ? (
              <div className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                  Convocazione
                </p>
                <p className="text-base font-bold tabular-nums">
                  {formatConvocationWallClockTime(meetingAt)}
                </p>
              </div>
            ) : null}
            <div className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                Partita
              </p>
              <p className="inline-flex items-center gap-1 text-base font-bold tabular-nums">
                <CalendarDays className="h-3.5 w-3.5 text-sky-200" aria-hidden />
                {formatConvocationWallClockTime(startAt)}
              </p>
            </div>
            {location ? (
              <div
                className={[
                  "rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5",
                  meetingAt ? "sm:col-span-1" : "sm:col-span-2",
                ].join(" ")}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                  Campo
                </p>
                <p className="inline-flex items-start gap-1 text-xs font-semibold leading-snug">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-200" aria-hidden />
                  <span className="line-clamp-2">{location}</span>
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {isConvoked || note ? (
          <div className="relative mt-2.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
            {isConvoked ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  Convocato
                </span>
                {responseStatus ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${CONVOCATION_RESPONSE_BADGE_CLASS[responseStatus]}`}
                  >
                    {CONVOCATION_RESPONSE_LABEL[responseStatus]}
                  </span>
                ) : null}
              </div>
            ) : null}
            {note ? (
              <p className="inline-flex min-w-0 max-w-full items-start gap-1.5 rounded-lg border border-sky-300/25 bg-sky-500/10 px-2.5 py-1.5 text-xs leading-snug text-sky-50 sm:min-w-[12rem] sm:flex-1">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-200" aria-hidden />
                <span className="whitespace-pre-wrap break-words">{note}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="relative mt-2.5 flex flex-wrap items-center gap-2">
          {phase === "FULL_TIME" && hasResult ? (
            <div className="inline-flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-sky-300/30 bg-sky-500/15 px-2.5 py-1.5 text-xs font-semibold">
              <span className="text-[10px] font-bold uppercase tracking-wide text-sky-100">
                La tua partita
              </span>
              {playerPresent === true ? (
                <span className="text-emerald-100">✓ Presente</span>
              ) : playerPresent === false ? (
                <span className="text-sky-100/80">— Assente</span>
              ) : null}
              {playerGoals > 0 ? <span>⚽ {playerGoals} gol</span> : null}
              {playerAssists > 0 ? <span>👟 {playerAssists} assist</span> : null}
            </div>
          ) : null}

          {mapsUrl ? (
            <Link
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-800 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-800 sm:ml-auto"
            >
              Apri il campo su Maps
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
