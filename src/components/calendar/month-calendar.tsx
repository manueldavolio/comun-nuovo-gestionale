"use client";

import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: "ALLENAMENTO" | "PARTITA" | "AMICHEVOLE" | "RIUNIONE" | "CONVOCAZIONE";
  categoryId?: string | null;
  categoryName?: string | null;
  location?: string | null;
  details?: string | null;
  athleteName?: string | null;
};

type MonthCalendarProps = {
  title?: string;
  subtitle?: string;
  events: CalendarEvent[];
  emptyMessage?: string;
  categoryOptions?: Array<{ id: string; name: string }>;
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const EVENT_TYPE_STYLES: Record<CalendarEvent["type"], string> = {
  ALLENAMENTO: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PARTITA: "border-red-200 bg-red-50 text-red-800",
  AMICHEVOLE: "border-blue-200 bg-blue-50 text-blue-800",
  RIUNIONE: "border-violet-200 bg-violet-50 text-violet-800",
  CONVOCAZIONE: "border-orange-200 bg-orange-50 text-orange-800",
};

const EVENT_TYPE_BADGE_LABEL: Record<CalendarEvent["type"], string> = {
  ALLENAMENTO: "ALLEN",
  AMICHEVOLE: "AMIC",
  PARTITA: "PART",
  RIUNIONE: "RIUN",
  CONVOCAZIONE: "CONV",
};

function toDate(value: string) {
  return parseISO(value);
}

export function MonthCalendar({
  title = "Calendario",
  subtitle = "Vista mensile degli eventi.",
  events,
  emptyMessage = "Nessun evento imminente.",
  categoryOptions = [],
}: MonthCalendarProps) {
  const now = new Date();
  const [activeMonth, setActiveMonth] = useState(startOfMonth(now));
  const [selectedDay, setSelectedDay] = useState<Date>(now);
  const [selectedCategoryId, setSelectedCategoryId] = useState("ALL");

  const filteredEvents = useMemo(() => {
    if (selectedCategoryId === "ALL") {
      return events;
    }
    return events.filter((event) => event.categoryId === selectedCategoryId);
  }, [events, selectedCategoryId]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of filteredEvents) {
      const key = format(toDate(event.date), "yyyy-MM-dd");
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

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">{title}</h2>
          <p className="mt-1 text-xs text-zinc-600 sm:text-sm">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setActiveMonth((prev) => addMonths(prev, -1))}
          className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 sm:text-sm"
          aria-label="Mese precedente"
        >
          {"<"}
        </button>
        <p className="text-sm font-semibold capitalize text-zinc-900 sm:text-base">
          {format(activeMonth, "MMMM yyyy", { locale: it })}
        </p>
        <button
          type="button"
          onClick={() => setActiveMonth((prev) => addMonths(prev, 1))}
          className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 sm:text-sm"
          aria-label="Mese successivo"
        >
          {">"}
        </button>
      </div>

      {categoryOptions.length > 1 ? (
        <div className="mt-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
            Categoria
            <select
              className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
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
        </div>
      ) : null}

      {events.length === 0 ? (
        <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div className="mt-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="rounded-lg bg-blue-50 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-blue-700 sm:text-xs"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1 sm:mt-2 sm:gap-2">
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
                      "min-h-24 rounded-xl border p-1.5 text-left transition sm:min-h-28 sm:p-2",
                      isCurrentMonth
                        ? "border-blue-100 bg-white hover:border-blue-300"
                        : "border-zinc-200 bg-zinc-50 text-zinc-400",
                      isSelected ? "ring-2 ring-blue-300" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={[
                          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold sm:h-6 sm:w-6 sm:text-xs",
                          isToday(day) ? "bg-blue-700 text-white" : "text-zinc-800",
                        ].join(" ")}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    <div className="mt-1 space-y-1 sm:mt-2">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={[
                            "rounded-full border px-1.5 py-0.5 text-center text-[10px] font-semibold sm:text-[11px]",
                            EVENT_TYPE_STYLES[event.type],
                          ].join(" ")}
                        >
                          {EVENT_TYPE_BADGE_LABEL[event.type]}
                        </div>
                      ))}
                      {dayEvents.length > 2 ? (
                        <div className="text-center text-[10px] font-semibold text-zinc-500 sm:text-[11px]">
                          +{dayEvents.length - 2}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </>
      )}
    </section>
  );
}
