import Link from "next/link";
import { Award } from "lucide-react";
import type { SeasonBadge } from "@/lib/parent-season";
import {
  POSITIVE_COACH_TAG_LABEL,
  type PositiveCoachTagCode,
} from "@/lib/coach-note-tags";

type AthleteAchievementsSectionProps = {
  badges: SeasonBadge[];
};

export function AthleteAchievementsSection({ badges }: AthleteAchievementsSectionProps) {
  if (badges.length === 0) return null;

  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
        I miei traguardi
      </p>
      <p className="mt-1 text-sm text-zinc-600">Presenza e costanza: i tuoi progressi personali.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="flex min-h-11 items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <Award className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-zinc-900">{badge.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

type AthleteRecentMatchesStripProps = {
  chips: Array<{
    id: string;
    present: boolean;
    goals: number;
    assists: number;
    opponentLabel: string;
  }>;
};

export function AthleteRecentMatchesStrip({ chips }: AthleteRecentMatchesStripProps) {
  if (chips.length === 0) return null;

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
          Ultime partite
        </p>
        <Link
          href="/genitore/calendario"
          className="min-h-11 inline-flex items-center text-xs font-semibold text-blue-700 hover:underline"
        >
          Calendario
        </Link>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => (
          <div
            key={chip.id}
            className="min-w-[5.5rem] shrink-0 rounded-2xl border border-sky-100 bg-sky-50/70 px-3 py-3 text-center"
            title={chip.opponentLabel}
          >
            <p className="text-lg font-black text-zinc-900">
              {chip.present ? "✓" : "—"}
            </p>
            <div className="mt-1 flex items-center justify-center gap-1 text-sm">
              {chip.goals > 0 ? <span title={`${chip.goals} gol`}>⚽</span> : null}
              {chip.assists > 0 ? <span title={`${chip.assists} assist`}>👟</span> : null}
              {chip.goals === 0 && chip.assists === 0 ? (
                <span className="text-[11px] font-medium text-zinc-500">
                  {chip.present ? "ok" : ""}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[10px] font-semibold uppercase text-zinc-500">
              {chip.opponentLabel}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

type CoachNoteCardProps = {
  content: string;
  year: number;
  month: number;
  authorLabel: string;
  monthLabel: string;
  positiveTags?: PositiveCoachTagCode[];
};

export function CoachNoteCard({
  content,
  year,
  monthLabel,
  authorLabel,
  positiveTags = [],
}: CoachNoteCardProps) {
  const initials = authorLabel
    .replace(/^Mister\s+/i, "")
    .replace(/^Staff\s*·\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "M";

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-800">
        Un messaggio dal tuo mister
      </p>
      <div className="mt-3 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-800 text-sm font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-blue-900">
            {authorLabel} · {monthLabel} {year}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-base font-medium leading-relaxed text-zinc-900">
            “{content.trim()}”
          </p>
          {positiveTags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {positiveTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-800"
                >
                  {POSITIVE_COACH_TAG_LABEL[tag] ?? tag}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-zinc-500">Solo per te e la famiglia</p>
        </div>
      </div>
    </section>
  );
}
