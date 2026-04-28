"use client";

import { useMemo, useState } from "react";
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

export type CalendarEventKind =
  | "TRAINING"
  | "LEAGUE_MATCH"
  | "FRIENDLY"
  | "MEETING"
  | "CONVOCATION"
  | "OTHER";

export type CalendarEventItem = {
  id: string;
  title: string;
  startsAtIso: string;
  kind: CalendarEventKind;
  typeLabel: string;
  location: string | null;
  details: string | null;
  categoryId: string | null;
  categoryName: string | null;
  athleteName?: string | null;
};

type MonthlyCalendarProps = {
  title: string;
  subtitle: string;
  events: CalendarEventItem[];
  categoryOptions?: Array<{ id: string; name: string }>;
  emptyMessage: string;
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const EVENT_KIND_STYLES: Record<CalendarEventKind, string> = {
  TRAINING: "border-emerald-200 bg-emerald-50 text-emerald-800",
  LEAGUE_MATCH: "border-blue-200 bg-blue-50 text-blue-800",
  FRIENDLY: "border-orange-200 bg-orange-50 text-orange-800",
  MEETING: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  CONVOCATION: "border-violet-200 bg-violet-50 text-violet-800",
  OTHER: "border-zinc-200 bg-zinc-100 text-zinc-800",
};

const EVENT_KIND_ORDER: CalendarEventKind[] = [
  "TRAINING",
  "LEAGUE_MATCH",
  "FRIENDLY",
  "MEETING",
  "CONVOCATION",
  "OTHER",
];

const EVENT_KIND_LABEL: Record<CalendarEventKind, string> = {
  TRAINING: "Allenamento",
  LEAGUE_MATCH: "Partita",
  FRIENDLY: "Amichevole",
  MEETING: "Riunione",
  CONVOCATION: "Convocazione",
  OTHER: "Altro",
};

const eventTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

const eventDateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toDate(value: string) {
  return parseISO(value);
}

export function MonthlyCalendar({
  title,
  subtitle,
  events,
  categoryOptions = [],
  emptyMessage,
}: MonthlyCalendarProps) {
  const today = new Date();
  const [activeMonth, setActiveMonth] = useState(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState<Date | null>(today);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<CalendarEventKind | "ALL">("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const kindMatch = selectedKind === "ALL" ? true : event.kind === selectedKind;
      const categoryMatch = selectedCategoryId === "ALL" ? true : event.categoryId === selectedCategoryId;
      return kindMatch && categoryMatch;
    });
  }, [events, selectedCategoryId, selectedKind]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const event of filteredEvents) {
      const dateKey = format(toDate(event.startsAtIso), "yyyy-MM-dd");
      const current = map.get(dateKey) ?? [];
      current.push(event);
      map.set(dateKey, current);
    }
    for (const [key, dayEvents] of map.entries()) {
      map.set(
        key,
        [...dayEvents].sort(
          (a, b) => toDate(a.startsAtIso).getTime() - toDate(b.startsAtIso).getTime(),
        ),
      );
    }
    return map;
  }, [filteredEvents]);

  const monthStart = startOfMonth(activeMonth);
  const monthEnd = endOfMonth(activeMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dayCells: Date[] = [];
  let pointer = calendarStart;
  while (pointer <= calendarEnd) {
    dayCells.push(pointer);
    pointer = addDays(pointer, 1);
  }

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) {
      return [];
    }
    const key = format(selectedDay, "yyyy-MM-dd");
    return eventsByDay.get(key) ?? [];
  }, [eventsByDay, selectedDay]);

  const selectedEvent = useMemo(
    () => selectedDayEvents.find((event) => event.id === selectedEventId) ?? null,
    [selectedDayEvents, selectedEventId],
  );

  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveMonth((prev) => addMonths(prev, -1))}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Mese precedente
          </button>
          <button
            type="button"
            onClick={() => {
              const nowMonth = startOfMonth(new Date());
              setActiveMonth(nowMonth);
              setSelectedDay(new Date());
            }}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            Oggi
          </button>
          <button
            type="button"
            onClick={() => setActiveMonth((prev) => addMonths(prev, 1))}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Mese successivo
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Tipo
            <select
              className="mt-1 block rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
              value={selectedKind}
              onChange={(event) => setSelectedKind(event.target.value as CalendarEventKind | "ALL")}
            >
              <option value="ALL">Tutti i tipi</option>
              {EVENT_KIND_ORDER.map((kind) => (
                <option key={kind} value={kind}>
                  {EVENT_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>

          {categoryOptions.length > 1 ? (
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Categoria
              <select
                className="mt-1 block rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
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
        </div>

        <p className="text-sm font-medium text-zinc-700">
          {format(activeMonth, "MMMM yyyy", { locale: it })}
        </p>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 gap-2">
                {DAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-blue-700"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {dayCells.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const inActiveMonth = isSameMonth(day, activeMonth);
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedDay(day);
                        setSelectedEventId(dayEvents[0]?.id ?? null);
                      }}
                      className={[
                        "min-h-28 rounded-lg border p-2 text-left transition",
                        inActiveMonth
                          ? "border-blue-100 bg-white hover:border-blue-300"
                          : "border-zinc-200 bg-zinc-50 text-zinc-400",
                        isSelected ? "ring-2 ring-blue-300" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={[
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                            isToday(day) ? "bg-blue-700 text-white" : "text-zinc-800",
                          ].join(" ")}
                        >
                          {format(day, "d")}
                        </span>
                        {dayEvents.length > 0 ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            {dayEvents.length}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className={[
                              "truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                              EVENT_KIND_STYLES[event.kind],
                            ].join(" ")}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 ? (
                          <div className="text-[11px] font-medium text-zinc-500">
                            +{dayEvents.length - 3} altri
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-blue-100 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-zinc-900">
                Impegni del giorno{" "}
                {selectedDay ? format(selectedDay, "EEEE d MMMM yyyy", { locale: it }) : ""}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p className="mt-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                  Nessun impegno nel giorno selezionato.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selectedDayEvents.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedEventId(event.id)}
                        className={[
                          "w-full rounded-lg border bg-white p-3 text-left",
                          selectedEventId === event.id
                            ? "border-blue-300 ring-1 ring-blue-300"
                            : "border-blue-100 hover:border-blue-200",
                        ].join(" ")}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-900">{event.title}</p>
                          <span
                            className={[
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                              EVENT_KIND_STYLES[event.kind],
                            ].join(" ")}
                          >
                            {event.typeLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">
                          {eventTimeFormatter.format(toDate(event.startsAtIso))}
                          {event.categoryName ? ` - ${event.categoryName}` : ""}
                          {event.athleteName ? ` - ${event.athleteName}` : ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-blue-100 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-zinc-900">Dettaglio evento</h3>
              {!selectedEvent ? (
                <p className="mt-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                  Tocca un evento per visualizzare i dettagli.
                </p>
              ) : (
                <article className="mt-2 rounded-lg border border-blue-100 bg-white p-3 text-sm text-zinc-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-zinc-900">{selectedEvent.title}</h4>
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                        EVENT_KIND_STYLES[selectedEvent.kind],
                      ].join(" ")}
                    >
                      {selectedEvent.typeLabel}
                    </span>
                  </div>
                  <p className="mt-2">
                    Data e ora: {eventDateTimeFormatter.format(toDate(selectedEvent.startsAtIso))}
                  </p>
                  <p className="mt-1">Categoria: {selectedEvent.categoryName ?? "Generale"}</p>
                  {selectedEvent.athleteName ? (
                    <p className="mt-1">Atleta: {selectedEvent.athleteName}</p>
                  ) : null}
                  <p className="mt-1">Luogo: {selectedEvent.location || "-"}</p>
                  <p className="mt-1">Dettagli: {selectedEvent.details || "-"}</p>
                </article>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
