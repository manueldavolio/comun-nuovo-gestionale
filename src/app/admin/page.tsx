import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DashboardCard } from "@/components/layout/dashboard-card";
import { AdminEventForms } from "@/components/events/admin-event-forms";
import { EventList } from "@/components/events/event-list";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { COACH_VISIBLE_EVENT_TYPES } from "@/lib/events";
import { StatusBadge } from "@/components/layout/status-badge";
import { AdminMedicalVisitRemindersActions } from "@/components/medical-visits/admin-medical-visit-reminders-actions";
import { getMedicalVisitReminderTargets } from "@/lib/medical-visits/reminders/search";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function AdminDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const now = new Date();
  const [totalUsers, totalCategories, activeCategories, activeStaff, categories, upcomingEvents, reminderTargets] =
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
    ]);

  const nextAttendanceEvent = upcomingEvents.find((event) => Boolean(event.category));
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
          <h2 className="text-base font-semibold text-slate-900">Azioni consigliate</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>- Verifica credenziali e ruolo degli utenti nuovi.</li>
            <li>- Aggiorna categorie prima dell&apos;apertura iscrizioni.</li>
            <li>- Controlla che i ruoli siano coerenti con l&apos;organigramma.</li>
          </ul>
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
            href="/admin/finanze"
            className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-200"
          >
            <h2 className="text-base font-semibold text-zinc-900">Contabilita e bilancio</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Monitora entrate, uscite, saldo attuale e previsione economica della societa.
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
        />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Promemoria visite mediche</h2>
              <p className="mt-1 text-sm text-slate-600">
                Consideriamo &quot;in scadenza&quot; entro 30 giorni (inclusi) e &quot;scadute&quot; se la data
                e&apos; gia&apos; passata.
              </p>
            </div>

            {session.user.role === "ADMIN" ? (
              <AdminMedicalVisitRemindersActions
                expiringCount={reminderTargets.expiring.length}
                expiredCount={reminderTargets.expired.length}
              />
            ) : (
              <p className="text-xs text-zinc-500">
                Invio promemoria disponibile solo per admin.
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-blue-100 bg-white p-3">
              <h3 className="text-sm font-semibold text-zinc-900">Visite in scadenza</h3>
              <p className="mt-1 text-xs text-zinc-600">Entro 30 giorni dalla data scadenza.</p>
              {reminderTargets.expiring.length === 0 ? (
                <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  Nessuna visita in scadenza.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-blue-100 text-xs">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-blue-800">
                        <th className="px-2 py-2 font-semibold">Atleta</th>
                        <th className="px-2 py-2 font-semibold">Categoria</th>
                        <th className="px-2 py-2 font-semibold">Scadenza</th>
                        <th className="px-2 py-2 font-semibold">Stato</th>
                        <th className="px-2 py-2 font-semibold">Email genitore</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50 text-zinc-700">
                      {reminderTargets.expiring.map((row) => (
                        <tr key={row.athleteId}>
                          <td className="px-2 py-2 font-medium text-zinc-900">{row.athleteFullName}</td>
                          <td className="px-2 py-2">{row.categoryName}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {row.expiryDate ? dateFormatter.format(new Date(row.expiryDate)) : "-"}
                          </td>
                          <td className="px-2 py-2">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-2 py-2">{row.parentEmail ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-blue-100 bg-white p-3">
              <h3 className="text-sm font-semibold text-zinc-900">Visite scadute</h3>
              <p className="mt-1 text-xs text-zinc-600">Scadenza passata.</p>
              {reminderTargets.expired.length === 0 ? (
                <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  Nessuna visita scaduta.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-blue-100 text-xs">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-blue-800">
                        <th className="px-2 py-2 font-semibold">Atleta</th>
                        <th className="px-2 py-2 font-semibold">Categoria</th>
                        <th className="px-2 py-2 font-semibold">Scadenza</th>
                        <th className="px-2 py-2 font-semibold">Stato</th>
                        <th className="px-2 py-2 font-semibold">Email genitore</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50 text-zinc-700">
                      {reminderTargets.expired.map((row) => (
                        <tr key={row.athleteId}>
                          <td className="px-2 py-2 font-medium text-zinc-900">{row.athleteFullName}</td>
                          <td className="px-2 py-2">{row.categoryName}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {row.expiryDate ? dateFormatter.format(new Date(row.expiryDate)) : "-"}
                          </td>
                          <td className="px-2 py-2">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-2 py-2">{row.parentEmail ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
