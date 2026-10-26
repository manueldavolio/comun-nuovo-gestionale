"use client";

import { useId, useState } from "react";
import { Goal, Percent, Shirt, Star } from "lucide-react";
import type { SeasonAthleteStats } from "@/lib/parent-season";
import {
  formatParentRatingAverage,
  type ParentSeasonRatingSummary,
} from "@/lib/parent-match-ratings";

type AthleteSeasonCardProps = {
  stats: SeasonAthleteStats;
  ratings: ParentSeasonRatingSummary;
};

function formatMatchDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(date);
}

export function AthleteSeasonCard({ stats, ratings }: AthleteSeasonCardProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const mediaLabel = formatParentRatingAverage(ratings.mediaVoti);
  const hasRatings = ratings.ratedMatchCount > 0 && ratings.mediaVoti != null;

  const items = [
    {
      key: "presenze",
      label: "Presenze partite",
      value: String(stats.matchPresences),
      icon: Shirt,
      tone: "border-blue-200 bg-gradient-to-br from-blue-50 to-white",
      iconTone: "bg-blue-800 text-white",
      valueTone: "text-blue-900",
    },
    {
      key: "gol",
      label: "Gol",
      value: String(stats.goals),
      icon: Goal,
      tone: "border-sky-200 bg-gradient-to-br from-sky-50 to-white",
      iconTone: "bg-sky-600 text-white",
      valueTone: "text-sky-900",
    },
    {
      key: "media",
      label: "Media voti",
      value: mediaLabel,
      icon: Star,
      tone: "border-blue-200 bg-gradient-to-br from-blue-50/80 to-sky-50",
      iconTone: "bg-blue-700 text-white",
      valueTone: "text-blue-950",
      interactive: hasRatings,
    },
    {
      key: "allenamenti",
      label: "Allenamenti %",
      value: stats.trainingPercent == null ? "—" : `${stats.trainingPercent}%`,
      icon: Percent,
      tone: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
      iconTone: "bg-emerald-700 text-white",
      valueTone: "text-emerald-900",
      hint:
        stats.trainingMarked > 0
          ? `${stats.trainingPresent}/${stats.trainingMarked}`
          : null,
    },
  ] as const;

  return (
    <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
        Presenze e statistiche
      </p>
      <p className="mt-1 text-sm text-zinc-600">I numeri di tuo figlio, senza confronti.</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {items.map((kpi) => {
          const Icon = kpi.icon;
          const isMedia = kpi.key === "media";
          const content = (
            <>
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${kpi.iconTone}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <p className={`mt-2 text-3xl font-black tracking-tight ${kpi.valueTone}`}>
                {kpi.value}
              </p>
              <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-600">
                {kpi.label}
              </p>
              {"hint" in kpi && kpi.hint ? (
                <p className="mt-1 text-[11px] font-semibold text-emerald-800">
                  Allenamenti: {kpi.hint}
                </p>
              ) : null}
              {isMedia && hasRatings ? (
                <p className="mt-1 text-[11px] font-semibold text-blue-800">
                  Tocca per il dettaglio
                </p>
              ) : null}
            </>
          );

          if (isMedia && hasRatings) {
            return (
              <button
                key={kpi.key}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((value) => !value)}
                className={`rounded-2xl border px-3 py-3 text-left transition hover:brightness-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${kpi.tone}`}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={kpi.key} className={`rounded-2xl border px-3 py-3 ${kpi.tone}`}>
              {content}
            </div>
          );
        })}
      </div>

      {open && hasRatings ? (
        <div
          id={panelId}
          className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-3"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-900">
            Voti per partita
          </p>
          <ul className="mt-2 space-y-2">
            {ratings.matches.map((match) => (
              <li
                key={match.eventId}
                className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-900">
                    {match.opponentLabel}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-500">
                    {formatMatchDate(match.startAt)}
                  </p>
                </div>
                <p className="text-lg font-black tabular-nums text-blue-900">
                  {match.matchAverage.toFixed(1)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
