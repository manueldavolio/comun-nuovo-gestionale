"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MATCH_LIFECYCLE_LABEL,
  MATCH_LIST_FILTER_LABEL,
  formatMatchKickoff,
  matchPassesFilter,
  sortMatchesForFilter,
  venueSideLabel,
  type MatchLifecycleStatus,
  type MatchListFilter,
} from "@/lib/matches";
import { formatMatchResultLabel } from "@/lib/parent-season";

export type MatchListItem = {
  id: string;
  startAt: string;
  title: string;
  opponentName: string | null;
  location: string | null;
  isHome: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  categoryName: string;
  status: MatchLifecycleStatus;
  href: string;
};

type MatchListClientProps = {
  items: MatchListItem[];
  wallNowIso: string;
  emptyLabel?: string;
};

const FILTERS: MatchListFilter[] = ["all", "upcoming", "played"];

export function MatchListClient({
  items,
  wallNowIso,
  emptyLabel = "Nessuna partita in questa stagione.",
}: MatchListClientProps) {
  const [filter, setFilter] = useState<MatchListFilter>("all");
  const wallNow = useMemo(() => new Date(wallNowIso), [wallNowIso]);

  const visible = useMemo(() => {
    const filtered = items.filter((item) =>
      matchPassesFilter(item.status, new Date(item.startAt), wallNow, filter),
    );
    return sortMatchesForFilter(
      filtered.map((item) => ({ ...item, startAt: new Date(item.startAt) })),
      filter,
    );
  }, [items, filter, wallNow]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
                active
                  ? "bg-blue-800 text-white"
                  : "border border-blue-100 bg-white text-blue-900 hover:bg-sky-50"
              }`}
            >
              {MATCH_LIST_FILTER_LABEL[value]}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-blue-200 bg-white/80 px-4 py-8 text-center text-sm text-zinc-600">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((match) => {
            const kickoff = formatMatchKickoff(new Date(match.startAt));
            const result = formatMatchResultLabel({
              opponentName: match.opponentName,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              isHome: match.isHome,
              fallbackTitle: match.title,
            });
            const opponent =
              (match.opponentName ?? "").trim() || match.title.trim() || "Partita";
            return (
              <li key={match.id}>
                <Link
                  href={match.href}
                  className="block rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:bg-sky-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                        {match.categoryName} · {venueSideLabel(match.isHome)}
                      </p>
                      <p className="mt-1 truncate text-base font-bold text-zinc-900">
                        vs {opponent}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {kickoff.dateLabel} · {kickoff.timeLabel}
                        {match.location ? ` · ${match.location}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-flex rounded-full border border-blue-100 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-blue-900">
                        {MATCH_LIFECYCLE_LABEL[match.status]}
                      </span>
                      <p className="mt-2 text-sm font-bold tabular-nums text-zinc-900">
                        {result ?? "—"}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
