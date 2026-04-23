import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DashboardCard } from "@/components/layout/dashboard-card";
import { AdminEventForms } from "@/components/events/admin-event-forms";
import { EventList } from "@/components/events/event-list";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { COACH_VISIBLE_EVENT_TYPES, formatEventType } from "@/lib/events";
import { AdminMedicalVisitRemindersActions } from "@/components/medical-visits/admin-medical-visit-reminders-actions";
import { getMedicalVisitReminderTargets } from "@/lib/medical-visits/reminders/search";
import { ANNOUNCEMENT_AUDIENCE_LABEL } from "@/lib/announcements";
import { euroFormatter } from "@/lib/finance";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type DecimalLike = {
  toString: () => string;
};

function toAmountNumber(value: DecimalLike | null | undefined) {
  if (!value) {
    return 0;
  }
  return Number(value.toString());
}

export default async function AdminDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const now = new Date();
  const canViewFinance = session.user.role === "ADMIN";
  const [totalUsers, totalCategories, activeCategories, activeStaff, categories, upcomingEvents, reminderTargets, recentEnrollments, recentAnnouncements, pendingPaymentsAggregate] =
    await Promise.all([
      prisma.user.count(),
      prisma.category.count(),
      prisma.category.count({ where: { isActive: true } }),
      prisma.user.count({
        where: {
          role: {
            in: ["ADMIN", "YOUTH_DIRECTOR", "COACH"],
          },
        },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          birthYearsLabel: true,
        },
      }),
      prisma.event.findMany({
        where: {
          startAt: {
            gte: now,
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
      getMedicalVisitReminderTargets({ now }),
      prisma.enrollment.findMany({
        where: {
          status: {
            in: ["SUBMITTED", "APPROVED"],
          },
        },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          createdAt: true,
          athlete: {
            select: {
              firstName: true,
              lastName: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.announcement.findMany({
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          audience: true,
          publishedAt: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      }),
      canViewFinance
        ? prisma.payment.aggregate({
            where: {
              status: {
                in: ["PENDING", "OVERDUE"],
              },
            },
            _count: {
              id: true,
            },
            _sum: {
              amount: true,
            },
          })
        : Promise.resolve({
            _count: { id: 0 },
            _sum: { amount: null },
          }),
    ]);

  const nextAttendanceEvent = upcomingEvents.find((event) => Boolean(event.category));
  const nextConvocationEvent = upcomingEvents.find((event) => Boolean(event.category));
  const upcomingPreviewEvents = upcomingEvents.slice(0, 5);
  const pendingPaymentsCount = canViewFinance ? pendingPaymentsAggregate._count.id : null;
  const pendingPaymentsAmount = canViewFinance
    ? toAmountNumber(pendingPaymentsAggregate._sum.amount)
    : null;
  const summaryCards = [
    {
      title: "Utenti totali",
      value: totalUsers,
      description: "Anagrafiche presenti a sistema",
      href: "/admin/utenti",
    },
    {
      title: "Categorie totali",
      value: totalCategories,
      description: "Fasce/squadre censite",
      href: "/admin/categorie",
    },
    {
      title: "Categorie attive",
      value: activeCategories,
      description: "Categorie operative in stagione",
      href: "/admin/categorie?filter=active",
    },
    {
      title: "Staff tecnico",
      value: activeStaff,
      description: "Admin, direzione tecnica e mister registrati",
      href: "/admin/staff",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Dashboard Admin"
          subtitle="Gestione società sportiva"
          userName={session.user.name ?? "Amministratore"}
        />
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Link key={card.title} href={card.href} className="block rounded-xl">
              <DashboardCard
                title={card.title}
                value={card.value}
                description={card.description}
                className="cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              />
            </Link>
          ))}
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Alert operativi</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <article className="rounded-lg border border-blue-100 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Visite mediche in scadenza</h3>
                  <p className="mt-1 text-xs text-zinc-600">Controllo entro 30 giorni e scadute.</p>
                </div>
                <Link
                  href="/admin/visite-mediche"
                  className="inline-flex rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Apri
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-amber-900">
                  <p className="text-[11px] uppercase tracking-wide">In scadenza</p>
                  <p className="mt-1 text-lg font-semibold">{reminderTargets.expiring.length}</p>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-red-800">
                  <p className="text-[11px] uppercase tracking-wide">Scadute</p>
                  <p className="mt-1 text-lg font-semibold">{reminderTargets.expired.length}</p>
                </div>
              </div>
              {session.user.role === "ADMIN" ? (
                <div className="mt-3">
                  <AdminMedicalVisitRemindersActions
                    expiringCount={reminderTargets.expiring.length}
                    expiredCount={reminderTargets.expired.length}
                  />
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">Invio promemoria disponibile solo per admin.</p>
              )}
            </article>

            <article className="rounded-lg border border-blue-100 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Pagamenti da verificare</h3>
                  <p className="mt-1 text-xs text-zinc-600">Stati non completati (pending e overdue).</p>
                </div>
                <Link
                  href="/admin/finanze"
                  className="inline-flex rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Apri
                </Link>
              </div>
              {canViewFinance ? (
                <div className="mt-3 space-y-2">
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-amber-900">Pagamenti aperti</p>
                    <p className="mt-1 text-lg font-semibold text-amber-900">{pendingPaymentsCount}</p>
                  </div>
                  <div className="rounded-md border border-blue-200 bg-white px-2 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-blue-900">Totale in sospeso</p>
                    <p className="mt-1 text-base font-semibold text-blue-900">
                      {euroFormatter.format(pendingPaymentsAmount ?? 0)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                  Dati economici disponibili solo per admin.
                </p>
              )}
            </article>

            <article className="rounded-lg border border-blue-100 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Convocazioni</h3>
                  <p className="mt-1 text-xs text-zinc-600">Crea convocazioni e monitora le risposte famiglie.</p>
                </div>
                <Link
                  href={nextConvocationEvent ? `/admin/eventi/${nextConvocationEvent.id}/convocazioni` : "/admin"}
                  className="inline-flex rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                >
                  Apri
                </Link>
              </div>
              {nextConvocationEvent ? (
                <div className="mt-3 rounded-md border border-violet-200 bg-white px-3 py-3 text-sm text-zinc-700">
                  Prossima gestione convocazioni su: <strong>{nextConvocationEvent.title}</strong>.
                </div>
              ) : (
                <div className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700">
                  Nessun evento categoria disponibile per convocazioni.
                </div>
              )}
            </article>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-3">
          <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Nuove iscrizioni</h2>
              <p className="mt-1 text-sm text-zinc-600">Ultime iscrizioni ricevute da gestione genitori.</p>
            </div>
            {recentEnrollments.length === 0 ? (
              <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                Nessuna nuova iscrizione.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentEnrollments.map((enrollment) => (
                  <li key={enrollment.id} className="rounded-lg border border-blue-100 bg-slate-50 p-2.5">
                    <p className="text-sm font-semibold text-zinc-900">
                      {`${enrollment.athlete.firstName} ${enrollment.athlete.lastName}`.trim()}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Categoria: {enrollment.athlete.category.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Data iscrizione:{" "}
                      {dateFormatter.format(new Date(enrollment.submittedAt ?? enrollment.createdAt))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/admin/atleti"
              className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Vai ad atleti/iscrizioni
            </Link>
          </article>

          <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Comunicazioni recenti</h2>
              <p className="mt-1 text-sm text-zinc-600">Ultimi avvisi pubblicati in bacheca.</p>
            </div>
            {recentAnnouncements.length === 0 ? (
              <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                Nessuna comunicazione recente.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentAnnouncements.map((announcement) => (
                  <li key={announcement.id} className="rounded-lg border border-blue-100 bg-slate-50 p-2.5">
                    <p className="text-sm font-semibold text-zinc-900">{announcement.title}</p>
                    <p className="text-xs text-zinc-600">
                      Audience: {ANNOUNCEMENT_AUDIENCE_LABEL[announcement.audience]}
                      {announcement.category?.name ? ` - ${announcement.category.name}` : " - Generale"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Data:{" "}
                      {announcement.publishedAt
                        ? dateFormatter.format(new Date(announcement.publishedAt))
                        : "Non pubblicata"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/admin/comunicazioni"
              className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Vai alle comunicazioni
            </Link>
          </article>

          <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Eventi imminenti</h2>
              <p className="mt-1 text-sm text-zinc-600">Prossimi appuntamenti sportivi in calendario.</p>
            </div>
            {upcomingPreviewEvents.length === 0 ? (
              <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                Nessun evento imminente.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcomingPreviewEvents.map((event) => (
                  <li key={event.id} className="rounded-lg border border-blue-100 bg-slate-50 p-2.5">
                    <p className="text-sm font-semibold text-zinc-900">{event.title}</p>
                    <p className="text-xs text-zinc-600">
                      {formatEventType(event.type)} - {event.category?.name ?? "Senza categoria"}
                    </p>
                    <p className="text-xs text-zinc-500">Data: {dateTimeFormatter.format(new Date(event.startAt))}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Link
            href="/admin/comunicazioni"
            className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-200"
          >
            <h2 className="text-base font-semibold text-zinc-900">Bacheca comunicazioni</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Crea avvisi per tutti, genitori, mister o categoria specifica.
            </p>
          </Link>
          <Link
            href="/admin/media"
            className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-200"
          >
            <h2 className="text-base font-semibold text-zinc-900">Media per categoria</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Pubblica e consulta foto/video per tutte le squadre.
            </p>
          </Link>
          <Link
            href="/admin/visite-mediche"
            className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-200"
          >
            <h2 className="text-base font-semibold text-zinc-900">Scadenze sanitarie</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Controlla rapidamente scadenze e promemoria visite mediche.
            </p>
          </Link>
        </section>

        {nextAttendanceEvent ? (
          <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Presenze evento</h2>
            <p className="mt-1 text-sm text-slate-600">
              Apri rapidamente l&apos;evento piu vicino per verificare o aggiornare l&apos;appello.
            </p>
            <Link
              href={`/admin/eventi/${nextAttendanceEvent.id}/presenze`}
              className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Gestisci presenze
            </Link>
          </section>
        ) : null}

        <AdminEventForms categories={categories} />

        <EventList
          title="Eventi pianificati"
          subtitle="Allenamenti, partite e tornei ordinati per data."
          events={upcomingEvents}
          emptyMessage="Nessun evento pianificato al momento."
          attendanceBasePath="/admin/eventi"
          convocationBasePath="/admin/eventi"
        />
      </div>
    </main>
  );
}
