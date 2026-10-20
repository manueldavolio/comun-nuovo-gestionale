import Link from "next/link";
import {
  MATCH_LIFECYCLE_LABEL,
  formatMatchKickoff,
  venueSideLabel,
  type MatchLifecycleStatus,
} from "@/lib/matches";
import { MATCH_RATING_CRITERION_LABEL } from "@/lib/match-player-rating";
import { formatParentRatingAverage } from "@/lib/parent-match-ratings";

export type MatchDetailViewModel = {
  id: string;
  title: string;
  startAtIso: string;
  location: string | null;
  opponentName: string | null;
  isHome: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  resultLabel: string | null;
  categoryName: string;
  status: MatchLifecycleStatus;
  clubName: string;
  scorers: Array<{
    athleteId: string;
    fullName: string;
    goals: number;
    assists: number;
  }>;
  cards: Array<{
    athleteId: string;
    fullName: string;
    label: string;
    minute: number | null;
  }>;
  ratings: Array<{
    athleteId: string;
    fullName: string;
    matchAverage: number | null;
    notes: string | null;
    possessionScore: number | null;
    outOfPossessionScore: number | null;
    attitudeScore: number | null;
    teamworkScore: number | null;
  }>;
  convocations: Array<{
    athleteId: string;
    fullName: string;
    responseLabel: string;
  }>;
  coachManageHref: string | null;
  backHref: string;
  audience: "coach" | "parent";
};

function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-blue-900">{title}</h2>
      <div className="mt-3">{empty ? <p className="text-sm text-zinc-500">Nessun dato.</p> : children}</div>
    </section>
  );
}

export function MatchDetailView({ match }: { match: MatchDetailViewModel }) {
  const kickoff = formatMatchKickoff(new Date(match.startAtIso));
  const opponent =
    (match.opponentName ?? "").trim() || match.title.trim() || "Avversario";
  const homeLabel = match.isHome === false ? opponent : match.clubName;
  const awayLabel = match.isHome === false ? match.clubName : opponent;
  const scoreHome = match.homeScore != null ? String(match.homeScore) : "—";
  const scoreAway = match.awayScore != null ? String(match.awayScore) : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={match.backHref}
          className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-sky-50"
        >
          ← Partite
        </Link>
        {match.coachManageHref ? (
          <Link
            href={match.coachManageHref}
            className="rounded-lg border border-blue-800 bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900"
          >
            Presenze e post-gara
          </Link>
        ) : null}
      </div>

      <header className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-sky-50 p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800">
          {match.categoryName} · {venueSideLabel(match.isHome)}
        </p>
        <h1 className="mt-1 text-xl font-bold text-zinc-900 sm:text-2xl">
          {homeLabel} vs {awayLabel}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {kickoff.dateLabel} · {kickoff.timeLabel}
          {match.location ? ` · ${match.location}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <p className="text-3xl font-black tabular-nums text-zinc-900">
            {scoreHome} – {scoreAway}
          </p>
          <span className="inline-flex rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-900">
            {MATCH_LIFECYCLE_LABEL[match.status]}
          </span>
        </div>
        {match.resultLabel ? (
          <p className="mt-2 text-sm font-semibold text-zinc-700">{match.resultLabel}</p>
        ) : null}
      </header>

      <Section title="Marcatori" empty={match.scorers.length === 0}>
        <ul className="space-y-2">
          {match.scorers.map((row) => (
            <li
              key={row.athleteId}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="font-semibold text-zinc-900">{row.fullName}</span>
              <span className="tabular-nums text-zinc-600">
                {row.goals > 0 ? `${row.goals} gol` : null}
                {row.goals > 0 && row.assists > 0 ? " · " : null}
                {row.assists > 0 ? `${row.assists} assist` : null}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Cartellini" empty={match.cards.length === 0}>
        <ul className="space-y-2">
          {match.cards.map((row) => (
            <li
              key={`${row.athleteId}-${row.label}-${row.minute ?? "x"}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="font-semibold text-zinc-900">{row.fullName}</span>
              <span className="text-zinc-600">
                {row.label}
                {row.minute != null ? ` · ${row.minute}'` : ""}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={match.audience === "parent" ? "Valutazione figlio" : "Valutazioni"}
        empty={match.ratings.length === 0}
      >
        <ul className="space-y-3">
          {match.ratings.map((row) => (
            <li key={row.athleteId} className="rounded-xl border border-blue-50 bg-sky-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-zinc-900">{row.fullName}</p>
                <p className="text-lg font-bold tabular-nums text-blue-900">
                  {formatParentRatingAverage(row.matchAverage)}
                </p>
              </div>
              {match.audience === "coach" ? (
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-zinc-600">
                  <span>
                    {MATCH_RATING_CRITERION_LABEL.possessionScore}:{" "}
                    {row.possessionScore ?? "—"}
                  </span>
                  <span>
                    {MATCH_RATING_CRITERION_LABEL.outOfPossessionScore}:{" "}
                    {row.outOfPossessionScore ?? "—"}
                  </span>
                  <span>
                    {MATCH_RATING_CRITERION_LABEL.attitudeScore}:{" "}
                    {row.attitudeScore ?? "—"}
                  </span>
                  <span>
                    {MATCH_RATING_CRITERION_LABEL.teamworkScore}:{" "}
                    {row.teamworkScore ?? "—"}
                  </span>
                </div>
              ) : null}
              {match.audience === "coach" && row.notes ? (
                <p className="mt-2 text-sm text-zinc-700">{row.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Convocazione" empty={match.convocations.length === 0}>
        <ul className="space-y-2">
          {match.convocations.map((row) => (
            <li
              key={row.athleteId}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="font-semibold text-zinc-900">{row.fullName}</span>
              <span className="rounded-full border border-blue-100 bg-white px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                {row.responseLabel}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
