"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { DeleteButton } from "@/components/common/delete-button";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  endDate?: string | null;
  type: "ALLENAMENTO" | "PARTITA" | "AMICHEVOLE" | "RIUNIONE" | "CONVOCAZIONE" | "TORNEO";
  categoryId?: string | null;
  categoryName?: string | null;
  location?: string | null;
  details?: string | null;
  athleteName?: string | null;
  /** Link rapido gestione evento (solo se il ruolo ha permesso). */
  manageHref?: string | null;
  manageLabel?: string | null;
  /** Link convocazione (mister/admin). */
  convocationHref?: string | null;
  /** Link modifica evento (admin/mister). */
  editHref?: string | null;
  /** Endpoint DELETE completo, es. `/api/events/xyz`. */
  deleteEndpoint?: string | null;
};

type MonthCalendarProps = {
  title?: string;
  subtitle?: string;
  events: CalendarEvent[];
  emptyMessage?: string;
  categoryOptions?: Array<{ id: string; name: string }>;
  /** Mostra il filtro tipo evento (default: false, comportamento genitore invariato). */
  showTypeFilter?: boolean;
  /**
   * Se impostato, al cambio mese ricarica gli eventi da questa API
   * (es. `/api/calendar/events`). Query: `?month=YYYY-MM`.
   */
  eventsSourceUrl?: string | null;
  /** Mese iniziale wall-clock `YYYY-MM` (Europe/Rome). Default: mese corrente browser se assente. */
  initialYearMonth?: string | null;
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const EVENT_TYPE_ORDER: CalendarEvent["type"][] = [
  "ALLENAMENTO",
  "PARTITA",
  "AMICHEVOLE",
  "TORNEO",
  "RIUNIONE",
  "CONVOCAZIONE",
];

const EVENT_TYPE_STYLES: Record<CalendarEvent["type"], string> = {
  ALLENAMENTO: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PARTITA: "border-red-200 bg-red-50 text-red-800",
  AMICHEVOLE: "border-blue-200 bg-blue-50 text-blue-800",
  TORNEO: "border-amber-200 bg-amber-50 text-amber-800",
  RIUNIONE: "border-violet-200 bg-violet-50 text-violet-800",
  CONVOCAZIONE: "border-orange-200 bg-orange-50 text-orange-800",
};

const EVENT_TYPE_BADGE_LABEL: Record<CalendarEvent["type"], string> = {
  ALLENAMENTO: "ALLEN",
  AMICHEVOLE: "AMIC",
  PARTITA: "PART",
  TORNEO: "TORN",
  RIUNIONE: "RIUN",
  CONVOCAZIONE: "CONV",
};

const EVENT_TYPE_LABEL: Record<CalendarEvent["type"], string> = {
  ALLENAMENTO: "Allenamento",
  PARTITA: "Partita",
  AMICHEVOLE: "Amichevole",
  TORNEO: "Torneo",
  RIUNIONE: "Riunione",
  CONVOCAZIONE: "Convocazione",
};

const eventDateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const eventTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

function toDate(value: string) {
  return parseISO(value);
}

/** Day key from floating datetime (`YYYY-MM-DDTHH:mm:ss`), ignoring local TZ shifts. */
function toDayKey(value: string) {
  return value.slice(0, 10);
}

function parseInitialMonth(initialYearMonth: string | null | undefined, fallback: Date) {
  if (initialYearMonth && /^\d{4}-\d{2}$/.test(initialYearMonth)) {
    const [y, m] = initialYearMonth.split("-").map(Number);
    if (y && m && m >= 1 && m <= 12) {
      return new Date(Date.UTC(y, m - 1, 1, 12, 0, 0, 0));
    }
  }
  return startOfMonth(fallback);
}

function formatEventDateTime(event: CalendarEvent) {
  const start = toDate(event.date);
  const dateLabel = eventDateTimeFormatter.format(start);
  const startTime = eventTimeFormatter.format(start);

  if (!event.endDate) {
    return `${dateLabel}, ${startTime}`;
  }

  const end = toDate(event.endDate);
  const endTime = eventTimeFormatter.format(end);
  return `${dateLabel}, ${startTime} - ${endTime}`;
}

export function MonthCalendar({
  title = "Calendario",
  subtitle = "Vista mensile degli eventi.",
  events,
  emptyMessage = "Nessun impegno imminente.",
  categoryOptions = [],
  showTypeFilter = false,
  eventsSourceUrl = null,
  initialYearMonth = null,
}: MonthCalendarProps) {
  const now = new Date();
  const [activeMonth, setActiveMonth] = useState(() =>
    parseInitialMonth(initialYearMonth, now),
  );
  const [selectedDay, setSelectedDay] = useState(() => {
    const month = parseInitialMonth(initialYearMonth, now);
    if (isSameMonth(now, month)) return now;
    return month;
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState("ALL");
  const [selectedType, setSelectedType] = useState<CalendarEvent["type"] | "ALL">("ALL");
  const [loadedEvents, setLoadedEvents] = useState<CalendarEvent[]>(events);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadedEvents(events);
  }, [events]);

  useEffect(() => {
    if (!eventsSourceUrl) return;

    const monthKey = format(activeMonth, "yyyy-MM");
    const controller = new AbortController();
    let cancelled = false;

    async function loadMonth() {
      setIsLoadingMonth(true);
      setLoadError(null);
      try {
        const response = await fetch(
          `${eventsSourceUrl}?month=${encodeURIComponent(monthKey)}`,
          { signal: controller.signal },
        );
        const body = (await response.json().catch(() => null)) as
          | { events?: CalendarEvent[]; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(body?.error ?? "Caricamento eventi non riuscito.");
        }
        if (!cancelled) {
          setLoadedEvents(Array.isArray(body?.events) ? body.events : []);
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Caricamento eventi non riuscito.",
          );
        }
      } finally {
        if (!cancelled) setIsLoadingMonth(false);
      }
    }

    void loadMonth();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeMonth, eventsSourceUrl]);

  const availableTypes = useMemo(() => {
    const present = new Set(loadedEvents.map((event) => event.type));
    return EVENT_TYPE_ORDER.filter((type) => present.has(type));
  }, [loadedEvents]);

  const filteredEvents = useMemo(() => {
    return loadedEvents.filter((event) => {
      const categoryMatch =
        selectedCategoryId === "ALL" ? true : event.categoryId === selectedCategoryId;
      const typeMatch = selectedType === "ALL" ? true : event.type === selectedType;
      return categoryMatch && typeMatch;
    });
  }, [loadedEvents, selectedCategoryId, selectedType]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of filteredEvents) {
      const key = toDayKey(event.date);
      const current = map.get(key) ?? [];
      current.push(event);
      map.set(key, current);
    }

    for (const [key, dayEvents] of map.entries()) {
      map.set(
        key,
        [...dayEvents].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime()),
      );
    }

    return map;
  }, [filteredEvents]);

  const selectedDayEvents = useMemo(() => {
    const key = format(selectedDay, "yyyy-MM-dd");
    return eventsByDay.get(key) ?? [];
  }, [eventsByDay, selectedDay]);

  const monthStart = startOfMonth(activeMonth);
  const monthEnd = endOfMonth(activeMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let pointer = gridStart;
  while (pointer <= gridEnd) {
    days.push(pointer);
    pointer = addDays(pointer, 1);
  }

  function goToMonth(delta: number) {
    setActiveMonth((prev) => {
      const next = addMonths(prev, delta);
      setSelectedDay((selected) => {
        if (isSameMonth(selected, next)) return selected;
        return startOfMonth(next);
      });
      return next;
    });
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">{title}</h2>
          <p className="mt-1 text-xs text-zinc-600 sm:text-sm">{subtitle}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {isLoadingMonth
              ? "Caricamento impegni…"
              : `${filteredEvents.length} impegni nel periodo`}
          </p>
          {loadError ? (
            <p className="mt-1 text-xs font-semibold text-red-700">{loadError}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 sm:text-sm"
          aria-label="Mese precedente"
        >
          {"<"}
        </button>
        <p className="text-sm font-semibold capitalize text-zinc-900 sm:text-base">
          {format(activeMonth, "MMMM yyyy", { locale: it })}
        </p>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 sm:text-sm"
          aria-label="Mese successivo"
        >
          {">"}
        </button>
      </div>

      {categoryOptions.length > 1 || (showTypeFilter && availableTypes.length > 1) ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {categoryOptions.length > 1 ? (
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
              Categoria
              <select
                className="mt-1 block min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
              >
                <option value="ALL">Tutte le categorie</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showTypeFilter && availableTypes.length > 1 ? (
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
              Tipo evento
              <select
                className="mt-1 block min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
                value={selectedType}
                onChange={(event) =>
                  setSelectedType(event.target.value as CalendarEvent["type"] | "ALL")
                }
              >
                <option value="ALL">Tutti i tipi</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {EVENT_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[700px] sm:min-w-0">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="rounded-lg bg-blue-50 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-blue-700 sm:py-2.5 sm:text-xs"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="mt-1.5 grid grid-cols-7 gap-1.5 sm:mt-2.5 sm:gap-2.5">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(key) ?? [];
              const isCurrentMonth = isSameMonth(day, activeMonth);
              const isSelected = isSameDay(day, selectedDay);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={[
                    "min-h-28 rounded-xl border p-2 text-left transition sm:min-h-32 sm:p-2.5 lg:min-h-36",
                    isCurrentMonth
                      ? "border-blue-100 bg-white hover:border-blue-300"
                      : "border-zinc-200 bg-zinc-50 text-zinc-400",
                    isSelected ? "border-blue-400 ring-2 ring-blue-300" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={[
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold sm:h-7 sm:w-7",
                        isToday(day) ? "bg-blue-700 text-white" : "text-zinc-800",
                      ].join(" ")}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1.5 sm:mt-2">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={[
                          "rounded-full border px-2 py-1 text-center text-[10px] font-semibold sm:text-xs",
                          EVENT_TYPE_STYLES[event.type],
                        ].join(" ")}
                      >
                        <span className="sm:hidden">{EVENT_TYPE_BADGE_LABEL[event.type]}</span>
                        <span className="hidden sm:inline">{EVENT_TYPE_LABEL[event.type]}</span>
                      </div>
                    ))}
                    {dayEvents.length > 2 ? (
                      <div className="text-center text-[10px] font-semibold text-zinc-500 sm:text-xs">
                        +{dayEvents.length - 2}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="mt-4 rounded-xl border border-blue-100 bg-slate-50 p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-zinc-900 sm:text-base">
          Impegni del giorno {format(selectedDay, "EEEE d MMMM yyyy", { locale: it })}
        </h3>
        {selectedDayEvents.length === 0 ? (
          <p className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
            {filteredEvents.length === 0 ? emptyMessage : "Nessun impegno per questo giorno"}
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:gap-3">
            {selectedDayEvents.map((event) => (
              <article
                key={event.id}
                className="rounded-xl border border-blue-100 bg-white p-3 text-sm text-zinc-700 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-zinc-900 sm:text-base">{event.title}</h4>
                  <span
                    className={[
                      "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                      EVENT_TYPE_STYLES[event.type],
                    ].join(" ")}
                  >
                    {EVENT_TYPE_LABEL[event.type]}
                  </span>
                </div>
                <p className="mt-2 text-sm">Data e ora: {formatEventDateTime(event)}</p>
                {event.location ? <p className="mt-1 text-sm">Luogo: {event.location}</p> : null}
                {event.categoryName ? (
                  <p className="mt-1 text-sm">Categoria: {event.categoryName}</p>
                ) : null}
                {event.manageHref ||
                event.convocationHref ||
                event.editHref ||
                event.deleteEndpoint ? (
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    {event.manageHref ? (
                      <Link
                        href={event.manageHref}
                        className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        {event.manageLabel ?? "Gestisci evento"}
                      </Link>
                    ) : null}
                    {event.convocationHref ? (
                      <Link
                        href={event.convocationHref}
                        className="inline-flex min-h-11 items-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-100"
                      >
                        Convocazione
                      </Link>
                    ) : null}
                    {event.editHref ? (
                      <Link
                        href={event.editHref}
                        className="inline-flex min-h-11 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        Modifica
                      </Link>
                    ) : null}
                    {event.deleteEndpoint ? (
                      <DeleteButton
                        endpoint={event.deleteEndpoint}
                        confirmMessage={`Eliminare "${event.title}"? L'operazione non si può annullare.`}
                        successMessage="Evento eliminato."
                      />
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
