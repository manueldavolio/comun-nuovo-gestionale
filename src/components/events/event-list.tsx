import Link from "next/link";
import type { EventType } from "@prisma/client";
import { formatEventType } from "@/lib/events";

type EventListItem = {
  id: string;
  title: string;
  type: EventType;
  startAt: Date;
  location: string | null;
  description: string | null;
  category: {
    name: string;
  } | null;
};

type EventListProps = {
  title: string;
  subtitle: string;
  events: EventListItem[];
  emptyMessage: string;
  attendanceBasePath?: string;
  convocationBasePath?: string;
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function EventList({
  title,
  subtitle,
  events,
  emptyMessage,
  attendanceBasePath,
  convocationBasePath,
}: EventListProps) {
  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border border-blue-100 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{event.title}</p>
                  <p className="text-xs uppercase tracking-wide text-blue-700">
                    {formatEventType(event.type)}
                  </p>
                </div>
                <p className="text-sm font-medium text-zinc-800">
                  {dateFormatter.format(new Date(event.startAt))}
                </p>
              </div>
              <div className="mt-2 flex flex-col gap-1 text-sm text-zinc-600">
                <p>Categoria: {event.category?.name ?? "Generale"}</p>
                <p>Luogo: {event.location || "-"}</p>
                {event.description ? <p>Note: {event.description}</p> : null}
              </div>
              {attendanceBasePath || convocationBasePath ? (
                event.category ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attendanceBasePath ? (
                      <Link
                        href={`${attendanceBasePath}/${event.id}/presenze`}
                        className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        Gestisci presenze
                      </Link>
                    ) : null}
                    {convocationBasePath ? (
                      <Link
                        href={`${convocationBasePath}/${event.id}/convocazioni`}
                        className="inline-flex rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-100"
                      >
                        Gestisci convocazione
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600">
                    Presenze/convocazioni non disponibili: evento senza categoria.
                  </p>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
