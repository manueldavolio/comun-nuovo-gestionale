import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DashboardCard } from "@/components/layout/dashboard-card";
import { EventList } from "@/components/events/event-list";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { COACH_VISIBLE_EVENT_TYPES } from "@/lib/events";
import { ANNOUNCEMENT_AUDIENCE_LABEL } from "@/lib/announcements";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function CoachDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister");
  }

  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);

  const now = new Date();
  const [categories, teamEvents, relevantAnnouncements] = await Promise.all([
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.category.findMany({
          where: {
            id: {
              in: coachCategoryIds,
            },
          },
          orderBy: { name: "asc" },
        }),
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.event.findMany({
          where: {
            startAt: {
              gte: now,
            },
            categoryId: {
              in: coachCategoryIds,
            },
            type: {
              in: COACH_VISIBLE_EVENT_TYPES,
            },
          },
          orderBy: [{ startAt: "asc" }],
          take: 80,
          select: {
            id: true,
            title: true,
            type: true,
            startAt: true,
            location: true,
            description: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        }),
    prisma.announcement.findMany({
      where: {
        publishedAt: {
          not: null,
          lte: now,
        },
        OR: [
          { audience: "ALL" },
          { audience: "COACHES" },
          {
            audience: "CATEGORY_ONLY",
            categoryId: {
              in: coachCategoryIds,
            },
          },
        ],
      },
      orderBy: [{ publishedAt: "desc" }],
      take: 10,
      select: {
        id: true,
        title: true,
        content: true,
        audience: true,
        publishedAt: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);
  const categoriesCount = categories.length;
  const nextEventId = teamEvents[0]?.id ?? null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <AreaHeader
          title="Area Mister"
          subtitle="Panoramica operativa staff tecnico"
          userName={session.user.name ?? "Mister"}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <DashboardCard
            title="Squadre assegnate"
            value={categoriesCount}
            description="Gruppi attivi disponibili per lo staff"
          />
          <DashboardCard
            title="Presenze da compilare"
            value={teamEvents.length}
            description="Eventi futuri con appello disponibile"
          />
          <DashboardCard
            title="Calendario"
            value={teamEvents.length}
            description="Eventi visibili per le tue categorie"
          />
        </section>

        <EventList
          title="Calendario squadra"
          subtitle="Visualizzi solo eventi collegati alle categorie assegnate."
          events={teamEvents}
          emptyMessage="Nessuna categoria assegnata o nessun evento disponibile."
          attendanceBasePath="/mister/eventi"
        />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Accesso rapido presenze</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Apri l&apos;evento piu vicino e aggiorna subito l&apos;appello.
          </p>
          {nextEventId ? (
            <Link
              href={`/mister/eventi/${nextEventId}/presenze`}
              className="mt-3 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Gestisci presenze
            </Link>
          ) : (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessun evento disponibile per la gestione presenze.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Comunicazioni per mister</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Visualizzi avvisi generali, dedicati mister e della tua categoria.
              </p>
            </div>
            <Link
              href="/mister/media"
              className="inline-flex w-fit rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Apri media categoria
            </Link>
          </div>

          {relevantAnnouncements.length === 0 ? (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessuna comunicazione recente disponibile.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {relevantAnnouncements.map((announcement) => (
                <article key={announcement.id} className="rounded-lg border border-blue-100 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">{announcement.title}</h3>
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                      {ANNOUNCEMENT_AUDIENCE_LABEL[announcement.audience]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {announcement.publishedAt
                      ? dateFormatter.format(new Date(announcement.publishedAt))
                      : "-"}
                    {announcement.category?.name ? ` - Categoria ${announcement.category.name}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-zinc-700">
                    {announcement.content.length > 180
                      ? `${announcement.content.slice(0, 180)}...`
                      : announcement.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Categorie disponibili</h2>
          {categories.length === 0 ? (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessuna categoria assegnata. Contatta l&apos;amministrazione per abilitare l&apos;area
              presenze.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {categories.map((category) => (
                <article
                  key={category.id}
                  className="rounded-lg border border-blue-100 px-3 py-2"
                >
                  <p className="font-medium text-zinc-900">{category.name}</p>
                  <p className="text-sm text-zinc-600">{category.birthYearsLabel}</p>
                  <p className="text-xs text-zinc-500">Stagione {category.seasonLabel}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
