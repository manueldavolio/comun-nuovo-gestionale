import Link from "next/link";
import { redirect } from "next/navigation";
import { subDays } from "date-fns";
import { AreaHeader } from "@/components/layout/area-header";
import { DashboardCard } from "@/components/layout/dashboard-card";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { COACH_VISIBLE_EVENT_TYPES, formatEventType } from "@/lib/events";
import {
  buildAthleteAttendanceStats,
  countConvocationResponses,
  type RecentEventSummary,
} from "@/lib/mister-stats";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const LOOKBACK_DAYS = 90;

type MisterRiepilogoPageProps = {
  searchParams?: Promise<{ categoryId?: string }>;
};

export default async function MisterRiepilogoPage({ searchParams }: MisterRiepilogoPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister/riepilogo");
  }

  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);
  const params = searchParams ? await searchParams : {};
  const requestedCategoryId = (params.categoryId ?? "").trim();
  const selectedCategoryId =
    requestedCategoryId && coachCategoryIds.includes(requestedCategoryId)
      ? requestedCategoryId
      : coachCategoryIds[0] ?? "";

  const now = new Date();
  const rangeStart = subDays(now, LOOKBACK_DAYS);

  const categories =
    coachCategoryIds.length === 0
      ? []
      : await prisma.category.findMany({
          where: { id: { in: coachCategoryIds } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, birthYearsLabel: true },
        });

  if (!selectedCategoryId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <AreaHeader
            title="Riepilogo mister"
            subtitle="Presenze e convocazioni delle tue categorie"
            userName={session.user.name ?? "Mister"}
          />
          <Link
            href="/mister"
            className="inline-flex w-fit rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna dashboard mister
          </Link>
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            Nessuna categoria assegnata. Contatta l&apos;amministrazione.
          </p>
        </div>
      </main>
    );
  }

  const [athletes, pastEvents, upcomingWithoutAttendance] = await Promise.all([
    prisma.athlete.findMany({
      where: { categoryId: selectedCategoryId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.event.findMany({
      where: {
        categoryId: selectedCategoryId,
        type: { in: COACH_VISIBLE_EVENT_TYPES },
        startAt: { gte: rangeStart, lt: now },
      },
      orderBy: [{ startAt: "desc" }],
      take: 40,
      select: {
        id: true,
        title: true,
        type: true,
        startAt: true,
        categoryId: true,
        category: { select: { name: true } },
        attendances: {
          select: { athleteId: true, status: true },
        },
        convocation: {
          select: {
            athletes: {
              select: { responseStatus: true },
            },
          },
        },
      },
    }),
    prisma.event.findMany({
      where: {
        categoryId: selectedCategoryId,
        type: { in: COACH_VISIBLE_EVENT_TYPES },
        startAt: { gte: now },
        attendances: { none: {} },
      },
      orderBy: [{ startAt: "asc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        startAt: true,
        type: true,
      },
    }),
  ]);

  const attendanceRecords = pastEvents.flatMap((event) => event.attendances);
  const athleteStats = buildAthleteAttendanceStats(athletes, attendanceRecords);

  const recentEvents: RecentEventSummary[] = pastEvents.map((event) => {
    const convocationCounts = countConvocationResponses(event.convocation?.athletes ?? []);
    const presentCount = event.attendances.filter((row) => row.status === "PRESENT").length;

    return {
      eventId: event.id,
      title: event.title,
      startAt: event.startAt,
      categoryId: event.categoryId ?? selectedCategoryId,
      categoryName: event.category?.name ?? "-",
      attendanceTaken: event.attendances.length > 0,
      attendanceMarked: event.attendances.length,
      attendancePresent: presentCount,
      hasConvocation: Boolean(event.convocation),
      convocationPending: convocationCounts.PENDING,
      convocationPresent: convocationCounts.PRESENT,
      convocationAbsent: convocationCounts.ABSENT,
    };
  });

  const eventsWithAttendance = recentEvents.filter((event) => event.attendanceTaken).length;
  const pendingResponses = recentEvents.reduce((sum, event) => sum + event.convocationPending, 0);
  const athletesWithData = athleteStats.filter((row) => row.marked > 0).length;
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Riepilogo mister"
          subtitle={`Presenze e convocazioni - ultimi ${LOOKBACK_DAYS} giorni`}
          userName={session.user.name ?? "Mister"}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/mister"
            className="inline-flex rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna dashboard mister
          </Link>
          <Link
            href="/mister/calendario"
            className="inline-flex rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            Apri calendario
          </Link>
        </div>

        {categories.length > 1 ? (
          <form method="get" className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <label className="text-sm font-medium text-zinc-700">
              Categoria
              <select
                name="categoryId"
                defaultValue={selectedCategoryId}
                className="mt-1 block w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.birthYearsLabel})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Mostra riepilogo
            </button>
          </form>
        ) : (
          <p className="text-sm text-zinc-700">
            Categoria: <span className="font-semibold">{selectedCategory?.name ?? "-"}</span>
          </p>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <DashboardCard
            title="Eventi con appello"
            value={`${eventsWithAttendance}/${recentEvents.length}`}
            description="Eventi passati con almeno una presenza registrata"
          />
          <DashboardCard
            title="Appelli da fare"
            value={upcomingWithoutAttendance.length}
            description="Eventi futuri ancora senza presenze"
          />
          <DashboardCard
            title="Risposte in attesa"
            value={pendingResponses}
            description="Convocazioni passate senza risposta famiglia"
          />
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Eventi recenti</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Ultimi eventi della categoria con stato appello e risposte convocazione.
          </p>

          {recentEvents.length === 0 ? (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessun evento negli ultimi {LOOKBACK_DAYS} giorni.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Data</th>
                    <th className="px-3 py-2 font-semibold">Evento</th>
                    <th className="px-3 py-2 font-semibold">Presenze</th>
                    <th className="px-3 py-2 font-semibold">Convocazione</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {recentEvents.map((event) => (
                    <tr key={event.eventId}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {dateFormatter.format(event.startAt)}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-zinc-900">{event.title}</p>
                      </td>
                      <td className="px-3 py-2">
                        {event.attendanceTaken
                          ? `${event.attendancePresent}/${event.attendanceMarked} presenti`
                          : "Non compilato"}
                      </td>
                      <td className="px-3 py-2">
                        {event.hasConvocation
                          ? `OK ${event.convocationPresent} · No ${event.convocationAbsent} · Attesa ${event.convocationPending}`
                          : "Non inviata"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/mister/eventi/${event.eventId}/presenze`}
                            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Presenze
                          </Link>
                          <Link
                            href={`/mister/eventi/${event.eventId}/convocazioni`}
                            className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                          >
                            Convocazioni
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">% presenza per atleta</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Calcolata sugli appelli già registrati ({athletesWithData} atleti con dati). Presente =
            solo stato &quot;Presente&quot;.
          </p>

          {athleteStats.length === 0 ? (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessun atleta in questa categoria.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Atleta</th>
                    <th className="px-3 py-2 font-semibold">% presenza</th>
                    <th className="px-3 py-2 font-semibold">Presenti</th>
                    <th className="px-3 py-2 font-semibold">Assenti</th>
                    <th className="px-3 py-2 font-semibold">Giust.</th>
                    <th className="px-3 py-2 font-semibold">Infort.</th>
                    <th className="px-3 py-2 font-semibold">Appelli</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {athleteStats.map((athlete) => (
                    <tr key={athlete.athleteId}>
                      <td className="px-3 py-2 font-medium text-zinc-900">{athlete.fullName}</td>
                      <td className="px-3 py-2">
                        {athlete.presencePercent === null ? "-" : `${athlete.presencePercent}%`}
                      </td>
                      <td className="px-3 py-2">{athlete.present}</td>
                      <td className="px-3 py-2">{athlete.absent}</td>
                      <td className="px-3 py-2">{athlete.justified}</td>
                      <td className="px-3 py-2">{athlete.injured}</td>
                      <td className="px-3 py-2">{athlete.marked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Prossimi eventi senza appello</h2>
          {upcomingWithoutAttendance.length === 0 ? (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessun evento futuro senza presenze.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcomingWithoutAttendance.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-2 rounded-lg border border-blue-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{event.title}</p>
                    <p className="text-xs text-zinc-500">
                      {formatEventType(event.type)} · {dateFormatter.format(event.startAt)}
                    </p>
                  </div>
                  <Link
                    href={`/mister/eventi/${event.id}/presenze`}
                    className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Compila presenze
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
