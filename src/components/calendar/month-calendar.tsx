"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
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

type CalendarViewMode = "month" | "week" | "list";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const VIEW_MODE_LABEL: Record<CalendarViewMode, string> = {
  month: "Mese",
  week: "Settimana",
  list: "Lista",
};

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
  AMICHEVOLE: "border-sky-200 bg-sky-50 text-sky-900",
  TORNEO: "border-amber-200 bg-amber-50 text-amber-900",
  RIUNIONE: "border-violet-200 bg-violet-50 text-violet-800",
  CONVOCAZIONE: "border-orange-200 bg-orange-50 text-orange-900",
};

const EVENT_TYPE_DOT: Record<CalendarEvent["type"], string> = {
  ALLENAMENTO: "bg-emerald-500",
  PARTITA: "bg-red-500",
  AMICHEVOLE: "bg-sky-500",
  TORNEO: "bg-amber-500",
  RIUNIONE: "bg-violet-500",
  CONVOCAZIONE: "bg-orange-500",
};

const EVENT_TYPE_ACCENT: Record<CalendarEvent["type"], string> = {
  ALLENAMENTO: "border-l-emerald-500",
  PARTITA: "border-l-red-500",
  AMICHEVOLE: "border-l-sky-500",
  TORNEO: "border-l-amber-500",
  RIUNIONE: "border-l-violet-500",
  CONVOCAZIONE: "border-l-orange-500",
};

const EVENT_TYPE_LABEL: Record<CalendarEvent["type"], string> = {
  ALLENAMENTO: "Allenamento",
  PARTITA: "Partita",
  AMICHEVOLE: "Amichevole",
  TORNEO: "Torneo",
  RIUNIONE: "Riunione",
  CONVOCAZIONE: "Convocazione",
};

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

function formatEventTimeRange(event: CalendarEvent) {
  const start = toDate(event.date);
  const startTime = eventTimeFormatter.format(start);
  if (!event.endDate) return startTime;
  const endTime = eventTimeFormatter.format(toDate(event.endDate));
  return `${startTime} – ${endTime}`;
}

function uniqueTypesInDay(dayEvents: CalendarEvent[]): CalendarEvent["type"][] {
  const seen = new Set<CalendarEvent["type"]>();
  const ordered: CalendarEvent["type"][] = [];
  for (const type of EVENT_TYPE_ORDER) {
    if (dayEvents.some((event) => event.type === type) && !seen.has(type)) {
      seen.add(type);
      ordered.push(type);
    }
  }
  return ordered;
}

function EventActions({ event }: { event: CalendarEvent }) {
  if (!event.manageHref && !event.convocationHref && !event.editHref && !event.deleteEndpoint) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-start gap-2">
      {event.manageHref ? (
        <Link
          href={event.manageHref}
          className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        >
          {event.manageLabel ?? "Gestisci evento"}
        </Link>
      ) : null}
      {event.convocationHref ? (
        <Link
          href={event.convocationHref}
          className="inline-flex min-h-11 items-center rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-800 hover:bg-violet-100"
        >
          Convocazione
        </Link>
      ) : null}
      {event.editHref ? (
        <Link
          href={event.editHref}
          className="inline-flex min-h-11 items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
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
  );
}

function EventAgendaCard({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  const startTime = eventTimeFormatter.format(toDate(event.date));
  return (
    <article
      className={[
        "rounded-2xl border border-blue-100 border-l-4 bg-white p-3 text-sm text-zinc-700 shadow-sm",
        EVENT_TYPE_ACCENT[event.type],
        compact ? "sm:p-3" : "sm:p-4",
      ].join(" ")}
    >
      <div className="flex gap-3">
        <div className="w-[3.25rem] shrink-0 pt-0.5 text-center">
          <p className="text-sm font-black tabular-nums leading-none text-blue-900">
            {startTime}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="min-w-0 flex-1 text-sm font-bold leading-snug text-zinc-900 sm:text-base">
              {event.title}
            </h4>
            <span
              className={[
                "inline-flex max-w-full shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                EVENT_TYPE_STYLES[event.type],
              ].join(" ")}
            >
              {EVENT_TYPE_LABEL[event.type]}
            </span>
          </div>
          <dl className="mt-2 space-y-0.5 text-xs text-zinc-600 sm:text-sm">
            <div>
              <dt className="sr-only">Orario completo</dt>
              <dd className="text-[11px] text-zinc-500 sm:text-xs">{formatEventTimeRange(event)}</dd>
            </div>
            {event.categoryName ? (
              <div>
                <dt className="sr-only">Squadra</dt>
                <dd className="font-semibold text-blue-900">{event.categoryName}</dd>
              </div>
            ) : null}
            {event.location ? (
              <div>
                <dt className="sr-only">Luogo</dt>
                <dd>{event.location}</dd>
              </div>
            ) : null}
            {event.athleteName ? (
              <div>
                <dt className="sr-only">Atleta</dt>
                <dd>{event.athleteName}</dd>
              </div>
            ) : null}
          </dl>
          <EventActions event={event} />
        </div>
      </div>
    </article>
  );
}

function DayCell({
  day,
  activeMonth,
  selectedDay,
  dayEvents,
  onSelect,
  density,
  todayKey,
}: {
  day: Date;
  activeMonth: Date;
  selectedDay: Date;
  dayEvents: CalendarEvent[];
  onSelect: (day: Date) => void;
  density: "month" | "week";
  todayKey: string | null;
}) {
  const isCurrentMonth = isSameMonth(day, activeMonth);
  const isSelected = isSameDay(day, selectedDay);
  const today = todayKey != null && format(day, "yyyy-MM-dd") === todayKey;
  const types = uniqueTypesInDay(dayEvents);
  const overflow = Math.max(0, types.length - 3);

  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      aria-label={`${format(day, "EEEE d MMMM", { locale: it })}${
        dayEvents.length > 0 ? `, ${dayEvents.length} impegni` : ""
      }`}
      aria-pressed={isSelected}
      className={[
        "flex w-full min-w-0 flex-col items-center overflow-hidden rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        density === "month"
          ? "min-h-11 gap-0.5 px-0.5 py-1 sm:min-h-[4.5rem] sm:items-stretch sm:gap-1 sm:p-1.5"
          : "min-h-[4.25rem] gap-1 p-1.5 sm:min-h-24",
        isCurrentMonth || density === "week"
          ? "border-blue-100/80 bg-white hover:border-blue-300 hover:bg-sky-50/60"
          : "border-transparent bg-zinc-50/80 text-zinc-400",
        isSelected ? "border-blue-700 bg-sky-50 ring-2 ring-blue-600/30" : "",
        today && !isSelected ? "border-blue-400" : "",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums sm:h-8 sm:w-8 sm:text-sm",
          today ? "bg-blue-800 text-white" : isSelected ? "bg-blue-100 text-blue-900" : "text-zinc-800",
          !isCurrentMonth && density === "month" ? "text-zinc-400" : "",
        ].join(" ")}
      >
        {format(day, "d")}
      </span>

      {/* Mobile: colored dots only */}
      <div className="flex max-w-full flex-wrap items-center justify-center gap-0.5 sm:hidden">
        {types.slice(0, 3).map((type) => (
          <span
            key={type}
            className={["h-1.5 w-1.5 rounded-full", EVENT_TYPE_DOT[type]].join(" ")}
            title={EVENT_TYPE_LABEL[type]}
          />
        ))}
        {overflow > 0 ? (
          <span className="text-[9px] font-bold leading-none text-zinc-500">+{overflow}</span>
        ) : null}
      </div>

      {/* Desktop / week: compact chips */}
      <div className="mt-auto hidden w-full space-y-0.5 sm:block">
        {dayEvents.slice(0, density === "week" ? 3 : 2).map((event) => (
          <div
            key={event.id}
            className={[
              "truncate rounded-md border px-1 py-0.5 text-[10px] font-semibold leading-tight",
              EVENT_TYPE_STYLES[event.type],
            ].join(" ")}
            title={event.title}
          >
            {EVENT_TYPE_LABEL[event.type]}
          </div>
        ))}
        {dayEvents.length > (density === "week" ? 3 : 2) ? (
          <p className="text-center text-[10px] font-semibold text-zinc-500">
            +{dayEvents.length - (density === "week" ? 3 : 2)}
          </p>
        ) : null}
      </div>
    </button>
  );
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
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
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
  /** Evita mismatch SSR/client su isToday e formattazioni locali. */
  const [todayKey, setTodayKey] = useState<string | null>(null);

  useEffect(() => {
    setTodayKey(format(new Date(), "yyyy-MM-dd"));
  }, []);

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

  const monthDays: Date[] = [];
  let pointer = gridStart;
  while (pointer <= gridEnd) {
    monthDays.push(pointer);
    pointer = addDays(pointer, 1);
  }

  const weekStart = startOfWeek(selectedDay, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const listEvents = useMemo(() => {
    const rangeStart =
      viewMode === "week" ? weekStart : startOfMonth(activeMonth);
    const rangeEnd =
      viewMode === "week"
        ? endOfWeek(selectedDay, { weekStartsOn: 1 })
        : endOfMonth(activeMonth);

    return filteredEvents
      .filter((event) => {
        const start = toDate(event.date);
        return start >= rangeStart && start <= rangeEnd;
      })
      .sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
  }, [filteredEvents, viewMode, weekStart, selectedDay, activeMonth]);

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

  function goToWeek(delta: number) {
    setSelectedDay((prev) => {
      const next = addWeeks(prev, delta);
      if (!isSameMonth(next, activeMonth)) {
        setActiveMonth(startOfMonth(next));
      }
      return next;
    });
  }

  function handlePeriodNav(delta: number) {
    if (viewMode === "week") {
      goToWeek(delta);
      return;
    }
    goToMonth(delta);
  }

  function selectDay(day: Date) {
    setSelectedDay(day);
    if (!isSameMonth(day, activeMonth)) {
      setActiveMonth(startOfMonth(day));
    }
  }

  const periodLabel =
    viewMode === "week"
      ? `${format(weekStart, "d MMM", { locale: it })} – ${format(
          endOfWeek(selectedDay, { weekStartsOn: 1 }),
          "d MMM yyyy",
          { locale: it },
        )}`
      : format(activeMonth, "MMMM yyyy", { locale: it });

  return (
    <section className="overflow-x-clip rounded-2xl border border-blue-100 bg-white p-3 shadow-sm sm:p-5 lg:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
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

      <div
        className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-blue-100 bg-sky-50/70 p-1"
        role="tablist"
        aria-label="Vista calendario"
      >
        {(Object.keys(VIEW_MODE_LABEL) as CalendarViewMode[]).map((mode) => {
          const active = viewMode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setViewMode(mode)}
              className={[
                "min-h-10 rounded-xl px-2 text-xs font-bold transition sm:text-sm",
                active
                  ? "bg-blue-800 text-white shadow-sm"
                  : "text-blue-900 hover:bg-white/80",
              ].join(" ")}
            >
              {VIEW_MODE_LABEL[mode]}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => handlePeriodNav(-1)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-sm font-semibold text-blue-800 hover:bg-sky-50"
          aria-label={viewMode === "week" ? "Settimana precedente" : "Mese precedente"}
        >
          {"‹"}
        </button>
        <p className="min-w-0 truncate text-center text-sm font-bold capitalize text-zinc-900 sm:text-base">
          {periodLabel}
        </p>
        <button
          type="button"
          onClick={() => handlePeriodNav(1)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-sm font-semibold text-blue-800 hover:bg-sky-50"
          aria-label={viewMode === "week" ? "Settimana successiva" : "Mese successivo"}
        >
          {"›"}
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

      {viewMode !== "list" ? (
        <div className="mt-4 w-full min-w-0">
          <div className="grid w-full grid-cols-7 gap-0.5 sm:gap-1.5">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="truncate py-1 text-center text-[10px] font-bold uppercase tracking-wide text-blue-800 sm:rounded-lg sm:bg-sky-50 sm:py-2 sm:text-xs"
              >
                <span className="sm:hidden">{label.charAt(0)}</span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-1 grid w-full grid-cols-7 gap-0.5 sm:mt-1.5 sm:gap-1.5">
            {(viewMode === "week" ? weekDays : monthDays).map((day) => {
              const key = format(day, "yyyy-MM-dd");
              return (
                <DayCell
                  key={key}
                  day={day}
                  activeMonth={activeMonth}
                  selectedDay={selectedDay}
                  dayEvents={eventsByDay.get(key) ?? []}
                  onSelect={selectDay}
                  density={viewMode === "week" ? "week" : "month"}
                  todayKey={todayKey}
                />
              );
            })}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-zinc-600 sm:text-xs">
            {EVENT_TYPE_ORDER.map((type) => (
              <li key={type} className="inline-flex items-center gap-1.5">
                <span className={["h-2 w-2 rounded-full", EVENT_TYPE_DOT[type]].join(" ")} />
                {EVENT_TYPE_LABEL[type]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {viewMode === "list" ? (
        <section className="mt-4" aria-label="Lista impegni del periodo">
          <h3 className="text-sm font-bold text-zinc-900 sm:text-base">
            Impegni · {periodLabel}
          </h3>
          {listEvents.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-blue-200 bg-sky-50/40 px-3 py-6 text-center text-sm text-zinc-600">
              {filteredEvents.length === 0 ? emptyMessage : "Nessun impegno in questo periodo"}
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {listEvents.map((event) => (
                <EventAgendaCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-4 rounded-2xl border border-blue-100 bg-gradient-to-b from-sky-50/80 to-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-zinc-900 sm:text-base">
              {format(selectedDay, "EEEE d MMMM", { locale: it })}
            </h3>
            {todayKey != null && format(selectedDay, "yyyy-MM-dd") === todayKey ? (
              <span className="rounded-full bg-blue-800 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                Oggi
              </span>
            ) : null}
          </div>
          {selectedDayEvents.length === 0 ? (
            <p className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-600">
              {filteredEvents.length === 0 ? emptyMessage : "Nessun impegno per questo giorno"}
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {selectedDayEvents.map((event) => (
                <EventAgendaCard key={event.id} event={event} compact />
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
