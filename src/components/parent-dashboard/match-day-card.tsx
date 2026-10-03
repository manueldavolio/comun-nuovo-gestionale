import Link from "next/link";
import { CalendarDays, CheckCircle2, MapPin, ExternalLink } from "lucide-react";
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
  homeScore: number | null;
  awayScore: number | null;
  playerGoals: number;
  playerAssists: number;
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
  homeScore,
  awayScore,
  playerGoals,
  playerAssists,
}: MatchDayCardProps) {
  const teams = matchDayTeamLayout({ opponentName, isHome });
  const mapsUrl = buildGoogleMapsSearchUrl(location);
  const hasResult = homeScore != null && awayScore != null;
  const score =
    hasResult
      ? matchDayScoreLines({
          opponentName,
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200">
            Match Day
          </p>
          <p className="mt-0.5 text-lg font-black tracking-tight sm:text-xl">
            {phaseBadge.label}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${phaseBadge.className}`}
        >
          {formatConvocationWallClockDate(startAt)}
        </span>
      </div>

      <div className="relative px-4 py-5 sm:px-6 sm:py-6">
        <div className="absolute -right-8 top-0 h-36 w-36 rounded-full bg-sky-400/10" aria-hidden />

        {phase === "FULL_TIME" && score ? (
          <div className="relative space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold uppercase tracking-wide text-sky-100 sm:text-base">
                  {score.leftName}
                </p>
                <p className="mt-1 text-4xl font-black tabular-nums sm:text-5xl">{score.leftScore}</p>
              </div>
              <p className="text-sm font-bold text-sky-200">FT</p>
              <div className="text-left">
                <p className="text-sm font-bold uppercase tracking-wide text-sky-100 sm:text-base">
                  {score.rightName}
                </p>
                <p className="mt-1 text-4xl font-black tabular-nums sm:text-5xl">{score.rightScore}</p>
              </div>
            </div>
          </div>
        ) : phase === "FULL_TIME" ? (
          <div className="relative space-y-3 text-center">
            <p className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
              {teams.topName}
            </p>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">vs</p>
            <p className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
              {teams.bottomName}
            </p>
            <p className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-sky-100">
              Risultato non ancora disponibile
            </p>
          </div>
        ) : (
          <div className="relative space-y-2 text-center">
            <p className="text-2xl font-black uppercase tracking-tight sm:text-4xl">
              {teams.topName}
            </p>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-200">vs</p>
            <p className="text-2xl font-black uppercase tracking-tight sm:text-4xl">
              {teams.bottomName}
            </p>
            {teams.mode === "neutral" ? (
              <p className="text-xs text-sky-200/90">{title}</p>
            ) : null}
          </div>
        )}

        {phase !== "FULL_TIME" || !hasResult ? (
          <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
            {meetingAt ? (
              <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-200">
                  Convocazione
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">
                  {formatConvocationWallClockTime(meetingAt)}
                </p>
              </div>
            ) : null}
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-200">
                Partita
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-lg font-bold tabular-nums">
                <CalendarDays className="h-4 w-4 text-sky-200" aria-hidden />
                {formatConvocationWallClockTime(startAt)}
              </p>
            </div>
            {location ? (
              <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-200">
                  Campo
                </p>
                <p className="mt-0.5 inline-flex items-start gap-1.5 text-sm font-semibold">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" aria-hidden />
                  {location}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {isConvoked ? (
          <div className="relative mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-100">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Convocato
            </span>
            {responseStatus ? (
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${CONVOCATION_RESPONSE_BADGE_CLASS[responseStatus]}`}
              >
                {CONVOCATION_RESPONSE_LABEL[responseStatus]}
              </span>
            ) : null}
          </div>
        ) : null}

        {phase === "FULL_TIME" && (playerGoals > 0 || playerAssists > 0) ? (
          <div className="relative mt-4 rounded-xl border border-sky-300/30 bg-sky-500/15 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-100">
              La tua partita
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
              {playerGoals > 0 ? <span>⚽ {playerGoals} GOL</span> : null}
              {playerAssists > 0 ? <span>🎯 {playerAssists} ASSIST</span> : null}
            </div>
          </div>
        ) : null}

        {mapsUrl ? (
          <div className="relative mt-5">
            <Link
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-800 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-800 sm:w-auto"
            >
              Apri il campo su Maps
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
