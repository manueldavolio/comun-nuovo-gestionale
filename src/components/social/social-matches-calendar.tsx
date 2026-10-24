"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  addDays,
} from "date-fns";
import { it } from "date-fns/locale";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { SocialMatchDto } from "@/lib/social-matches";

type SocialMatchesCalendarProps = {
  initialMonth: string;
  initialMatches: SocialMatchDto[];
  categories: Array<{ id: string; name: string }>;
  userName: string;
};

type ViewMode = "month" | "list";

function toDayKey(iso: string) {
  return iso.slice(0, 10);
}

function formatKickoff(iso: string) {
  const date = parseISO(iso);
  return {
    dateLabel: new Intl.DateTimeFormat("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(date),
    timeLabel: new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date),
  };
}

function MatchCard({ match }: { match: SocialMatchDto }) {
  const kickoff = formatKickoff(match.startAt);
  const opponent = (match.opponentName ?? "").trim() || match.title.trim() || "Avversario";
  return (
    <article className="rounded-2xl border border-blue-100 border-l-4 border-l-blue-700 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-800">
            {match.categoryName} · {match.venueSide}
          </p>
          <h3 className="mt-1 text-sm font-bold text-zinc-900 sm:text-base">vs {opponent}</h3>
          <p className="mt-1 text-xs text-zinc-600 sm:text-sm">
            {kickoff.dateLabel} · {kickoff.timeLabel}
            {match.location ? ` · ${match.location}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-blue-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-blue-900">
          {match.typeLabel}
        </span>
      </div>
    </article>
  );
}

export function SocialMatchesCalendar({
  initialMonth,
  initialMatches,
  categories,
  userName,
}: SocialMatchesCalendarProps) {
  const [month, setMonth] = useState(initialMonth);
  const [matches, setMatches] = useState(initialMatches);
  const [categoryId, setCategoryId] = useState("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDay, setSelectedDay] = useState(() => {
    const [y, m] = initialMonth.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1, 1, 12, 0, 0, 0));
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMonth(nextMonth: string, nextCategoryId: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month: nextMonth });
      if (nextCategoryId !== "ALL") params.set("categoryId", nextCategoryId);
      const response = await fetch(`/api/social/matches?${params.toString()}`);
      const body = (await response.json().catch(() => null)) as
        | { data?: { matches?: SocialMatchDto[] }; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Caricamento non riuscito.");
      }
      setMatches(Array.isArray(body?.data?.matches) ? body!.data!.matches! : []);
      setMonth(nextMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caricamento non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  const activeMonthDate = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1, 1, 12, 0, 0, 0));
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, SocialMatchDto[]>();
    for (const match of matches) {
      const key = toDayKey(match.startAt);
      const list = map.get(key) ?? [];
      list.push(match);
      map.set(key, list);
    }
    return map;
  }, [matches]);

  const selectedKey = format(selectedDay, "yyyy-MM-dd");
  const selectedMatches = eventsByDay.get(selectedKey) ?? [];

  const monthStart = startOfMonth(activeMonthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(activeMonthDate), { weekStartsOn: 1 });
  const days: Date[] = [];
  let pointer = gridStart;
  while (pointer <= gridEnd) {
    days.push(pointer);
    pointer = addDays(pointer, 1);
  }

  function shiftMonth(delta: number) {
    const next = addMonths(activeMonthDate, delta);
    const key = format(next, "yyyy-MM");
    setSelectedDay(startOfMonth(next));
    void loadMonth(key, categoryId);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <header className="rounded-2xl border border-blue-700 bg-blue-800 p-5 text-white shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
              Comun Nuovo Calcio
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Calendario partite</h1>
            <p className="mt-1 text-sm text-sky-100">
              Solo lettura · tutte le categorie · {userName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/social/studio"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-blue-950 hover:bg-white"
            >
              Social Studio
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="overflow-x-clip rounded-2xl border border-blue-100 bg-white p-3 shadow-sm sm:p-5">
        <div
          className="grid grid-cols-2 gap-1 rounded-2xl border border-blue-100 bg-sky-50/70 p-1"
          role="tablist"
          aria-label="Vista calendario"
        >
          {(
            [
              ["month", "Mese"],
              ["list", "Lista"],
            ] as const
          ).map(([mode, label]) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setViewMode(mode)}
                className={`min-h-10 rounded-xl text-sm font-bold transition ${
                  active ? "bg-blue-800 text-white" : "text-blue-900 hover:bg-white/80"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-800"
            aria-label="Mese precedente"
          >
            ‹
          </button>
          <p className="text-sm font-bold capitalize text-zinc-900 sm:text-base">
            {format(activeMonthDate, "MMMM yyyy", { locale: it })}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-800"
            aria-label="Mese successivo"
          >
            ›
          </button>
        </div>

        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
          Categoria
          <select
            className="mt-1 block min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={categoryId}
            onChange={(event) => {
              const next = event.target.value;
              setCategoryId(next);
              void loadMonth(month, next);
            }}
          >
            <option value="ALL">Tutte le categorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Caricamento partite…</p>
        ) : null}
        {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}

        {viewMode === "month" ? (
          <>
            <div className="mt-4 grid w-full grid-cols-7 gap-0.5 sm:gap-1.5">
              {["L", "M", "M", "G", "V", "S", "D"].map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="py-1 text-center text-[10px] font-bold uppercase text-blue-800"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-1 grid w-full grid-cols-7 gap-0.5 sm:gap-1.5">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayMatches = eventsByDay.get(key) ?? [];
                const inMonth = isSameMonth(day, activeMonthDate);
                const selected = isSameDay(day, selectedDay);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    aria-pressed={selected}
                    className={[
                      "flex min-h-11 min-w-0 flex-col items-center rounded-xl border px-0.5 py-1",
                      inMonth ? "border-blue-100 bg-white" : "border-transparent bg-zinc-50 text-zinc-400",
                      selected ? "border-blue-700 ring-2 ring-blue-600/30" : "",
                    ].join(" ")}
                  >
                    <span className="text-xs font-bold tabular-nums">{format(day, "d")}</span>
                    <div className="mt-0.5 flex gap-0.5">
                      {dayMatches.slice(0, 3).map((match) => (
                        <span
                          key={match.id}
                          className="h-1.5 w-1.5 rounded-full bg-blue-700"
                          title={match.typeLabel}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <section className="mt-4 rounded-2xl border border-blue-100 bg-sky-50/50 p-3">
              <h2 className="text-sm font-bold text-zinc-900">
                {format(selectedDay, "EEEE d MMMM", { locale: it })}
              </h2>
              {selectedMatches.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600">Nessuna partita in questo giorno.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {selectedMatches.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-4" aria-label="Lista partite del mese">
            <h2 className="text-sm font-bold text-zinc-900">
              Partite · {format(activeMonthDate, "MMMM yyyy", { locale: it })}
            </h2>
            {matches.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-blue-200 px-3 py-6 text-center text-sm text-zinc-600">
                Nessuna partita nel periodo selezionato.
              </p>
            ) : (
              <div className="mt-3 grid gap-2">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
