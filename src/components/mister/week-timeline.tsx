import Link from "next/link";
import { formatConvocationWallClockTime } from "@/lib/convocation-times";
import { resolveMatchDayOpponentName } from "@/lib/match-day";
import { isMatchWeekEvent, type MisterWeekDay } from "@/lib/mister-week";

export function WeekTimeline({ days }: { days: MisterWeekDay[] }) {
  if (days.length === 0) {
    return (
      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-900">Questa settimana</h2>
        <p className="mt-2 text-sm text-zinc-600">Nessun impegno in agenda.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-zinc-900">Questa settimana</h2>
        <Link
          href="/mister/calendario"
          className="text-xs font-semibold text-blue-700 hover:underline"
        >
          Calendario completo
        </Link>
      </div>

      <ul className="mt-3 space-y-2">
        {days.map((day) => (
          <li
            key={day.date.toISOString()}
            className={`rounded-xl border px-3 py-2 ${
              day.isToday
                ? "border-blue-300 bg-sky-50"
                : "border-transparent bg-transparent"
            }`}
          >
            <div className="flex gap-3">
              <div className="w-10 shrink-0">
                <p
                  className={`text-xs font-black uppercase tracking-wide ${
                    day.isToday ? "text-blue-800" : "text-zinc-500"
                  }`}
                >
                  {day.weekdayShort}
                </p>
                {day.isToday ? (
                  <p className="text-[10px] font-semibold text-blue-600">oggi</p>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {day.events.length === 0 ? (
                  <p className="text-sm text-zinc-500">—</p>
                ) : (
                  day.events.map((event) => {
                    const match = isMatchWeekEvent(event.type);
                    const opponent = resolveMatchDayOpponentName({
                      opponentName: event.opponentName,
                      title: event.title,
                    });
                    const label = match
                      ? `⚽ Comun Nuovo - ${opponent}`
                      : event.title;
                    return (
                      <Link
                        key={event.id}
                        href={`/mister/eventi/${event.id}/presenze`}
                        className={`block truncate text-sm font-semibold hover:underline ${
                          match ? "text-blue-900" : "text-zinc-800"
                        }`}
                      >
                        {label}{" "}
                        <span className="font-medium text-zinc-500">
                          {formatConvocationWallClockTime(event.startAt)}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
