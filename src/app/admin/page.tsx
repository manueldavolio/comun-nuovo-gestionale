import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  FileWarning,
  HeartPulse,
  Users,
  UserRound,
  Wallet,
  Megaphone,
  Images,
  Link2,
  LayoutGrid,
  Trophy,
  Dumbbell,
} from "lucide-react";
import { AdminDashboardHero } from "@/components/admin/admin-dashboard-hero";
import { AdminEventForms } from "@/components/events/admin-event-forms";
import { EventList } from "@/components/events/event-list";
import { AdminMedicalVisitRemindersActions } from "@/components/medical-visits/admin-medical-visit-reminders-actions";
import {
  YD_QUICK_LINKS,
  announcementWidgetWhereForRole,
  enrollmentWidgetWhereForRole,
  youthDirectorAthleteCategoryFilter,
  youthDirectorDocumentAthleteFilter,
} from "@/lib/admin-dashboard-yd";
import { listManageableCategoryIdsForEvents } from "@/lib/category-event-access";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { COACH_VISIBLE_EVENT_TYPES, formatEventType } from "@/lib/events";
import { getMedicalVisitReminderTargets } from "@/lib/medical-visits/reminders/search";
import { ANNOUNCEMENT_AUDIENCE_LABEL } from "@/lib/announcements";
import { euroFormatter } from "@/lib/finance";
import { currentSeasonRange, isMatchEventType } from "@/lib/parent-season";

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

function seasonLabelFromConfig(now: Date) {
  const season = currentSeasonRange(now);
  const startYear = season.start.getUTCFullYear();
  return `${startYear}/${startYear + 1}`;
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
  const role = session.user.role;
  const canViewFinance = role === "ADMIN";
  const isAdmin = role === "ADMIN";
  const isYouthDirector = role === "YOUTH_DIRECTOR";
  const seasonLabel = seasonLabelFromConfig(now);

  // YD: tutte le categorie YOUTH (non le sole assegnazioni coach). ADMIN: nessuna restrizione.
  const manageableCategoryIds = isYouthDirector
    ? await listManageableCategoryIdsForEvents({
        userId: session.user.id,
        role,
        activeOnly: true,
      })
    : null;
  const eventCategoryFilter =
    manageableCategoryIds != null ? { categoryId: { in: manageableCategoryIds } } : {};

  const youthAthleteFilter =
    manageableCategoryIds != null
      ? youthDirectorAthleteCategoryFilter(manageableCategoryIds)
      : {};
  const youthDocumentFilter =
    manageableCategoryIds != null
      ? youthDirectorDocumentAthleteFilter(manageableCategoryIds)
      : {};

  const [
    activeAthletes,
    withdrawnAthletes,
    activeCategories,
    activeStaff,
    archiveDocumentsCount,
    categories,
    upcomingEvents,
    reminderTargets,
    recentEnrollments,
    recentAnnouncements,
    pendingPaymentsAggregate,
  ] = await Promise.all([
    prisma.athlete.count({
      where: { rosterStatus: "ACTIVE", ...youthAthleteFilter },
    }),
    prisma.athlete.count({
      where: { rosterStatus: "WITHDRAWN", ...youthAthleteFilter },
    }),
    prisma.category.count({ where: { isActive: true } }),
    prisma.user.count({
      where: {
        role: {
          in: ["ADMIN", "YOUTH_DIRECTOR", "COACH"],
        },
      },
    }),
    // Archivio Document (metadati), non enrollment docs né certificati medici.
    // YD: solo documenti di atleti in categorie YOUTH.
    prisma.document.count({ where: youthDocumentFilter }),
    prisma.category.findMany({
      where: {
        isActive: true,
        ...(manageableCategoryIds != null ? { id: { in: manageableCategoryIds } } : {}),
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        birthYearsLabel: true,
      },
    }),
    prisma.event.findMany({
      where: {
        ...eventCategoryFilter,
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
    getMedicalVisitReminderTargets({
      now,
      ...(manageableCategoryIds != null ? { categoryIds: manageableCategoryIds } : {}),
    }),
    prisma.enrollment.findMany({
      where: enrollmentWidgetWhereForRole(role),
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
      where: announcementWidgetWhereForRole(role),
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
  const upcomingMatches = upcomingEvents
    .filter((event) => isMatchEventType(event.type))
    .slice(0, 4);
  const upcomingTrainings = upcomingEvents
    .filter((event) => event.type === "TRAINING")
    .slice(0, 4);
  const upcomingEventsWithDelete = upcomingEvents.map((event) => ({
    ...event,
    canDelete: true,
    canEdit: true,
  }));
  const pendingPaymentsCount = canViewFinance ? pendingPaymentsAggregate._count.id : null;
  const pendingPaymentsAmount = canViewFinance
    ? toAmountNumber(pendingPaymentsAggregate._sum.amount)
    : null;
  const medicalAlertCount =
    reminderTargets.expiring.length + reminderTargets.expired.length;

  const kpiCards = isYouthDirector
    ? [
        {
          title: "Atleti attivi",
          value: activeAthletes,
          description: "Rosa operativa settore giovanile",
          href: "/admin/atleti",
          tone: "border-blue-200 bg-gradient-to-br from-white to-blue-50/40",
          valueTone: "text-blue-950",
        },
        {
          title: "Atleti ritirati",
          value: withdrawnAthletes,
          description: "Fuori rosa giovanile, storico conservato",
          href: "/admin/atleti?status=withdrawn",
          tone: "border-sky-100 bg-gradient-to-br from-white to-slate-50",
          valueTone: "text-slate-800",
        },
        {
          title: "Visite da controllare",
          value: medicalAlertCount,
          description: "Scadute/in scadenza — solo giovanili",
          href: "/admin/visite-mediche",
          tone: "border-red-200 bg-gradient-to-br from-white to-red-50/50",
          valueTone: "text-red-900",
        },
        {
          title: "Documenti in archivio",
          value: archiveDocumentsCount,
          description: "Metadati Document — atleti giovanili",
          href: "/admin/documenti",
          tone: "border-sky-200 bg-gradient-to-br from-white to-sky-50/50",
          valueTone: "text-sky-950",
        },
      ]
    : [
        {
          title: "Atleti attivi",
          value: activeAthletes,
          description: "In rosa operativa",
          href: "/admin/atleti",
          tone: "border-blue-200 bg-gradient-to-br from-white to-blue-50/40",
          valueTone: "text-blue-950",
        },
        {
          title: "Atleti ritirati",
          value: withdrawnAthletes,
          description: "Fuori rosa, storico conservato",
          href: "/admin/atleti?status=withdrawn",
          tone: "border-sky-100 bg-gradient-to-br from-white to-slate-50",
          valueTone: "text-slate-800",
        },
        {
          title: "Categorie attive",
          value: activeCategories,
          description: "Squadre operative in stagione",
          href: "/admin/categorie?filter=active",
          tone: "border-sky-200 bg-gradient-to-br from-white to-sky-50/50",
          valueTone: "text-sky-950",
        },
        {
          title: "Staff tecnico",
          value: activeStaff,
          description: "Admin, direzione e mister",
          href: "/admin/staff",
          tone: "border-blue-100 bg-gradient-to-br from-white to-blue-50/30",
          valueTone: "text-blue-900",
        },
        ...(canViewFinance
          ? [
              {
                title: "Pagamenti da verificare",
                value: pendingPaymentsCount ?? 0,
                description:
                  pendingPaymentsAmount != null
                    ? `In sospeso ${euroFormatter.format(pendingPaymentsAmount)}`
                    : "Pending e overdue",
                href: "/admin/finanze",
                tone: "border-sky-200 bg-gradient-to-br from-white to-sky-50",
                valueTone: "text-sky-950",
              },
            ]
          : []),
      ];

  const quickLinkIcons: Record<string, typeof CalendarDays> = {
    "/admin/calendario": CalendarDays,
    "/admin/atleti": Users,
    "/admin/categorie": LayoutGrid,
    "/admin/staff": UserRound,
    "/admin/finanze": Wallet,
    "/admin/schedina": Trophy,
    "/admin/associazioni-genitori": Link2,
    "/admin/utenti": UserRound,
    "/admin/comunicazioni": Megaphone,
    "/admin/media": Images,
    "/admin/visite-mediche": HeartPulse,
    "/admin/documenti": FileText,
  };

  const quickLinks = isYouthDirector
    ? YD_QUICK_LINKS.map((item) => ({
        ...item,
        icon: quickLinkIcons[item.href] ?? FileWarning,
      }))
    : [
        {
          href: "/admin/calendario",
          label: "Calendario",
          description: "Vista mensile eventi",
          icon: CalendarDays,
        },
        {
          href: "/admin/atleti",
          label: "Atleti",
          description: "Rose e anagrafiche",
          icon: Users,
        },
        {
          href: "/admin/categorie",
          label: "Categorie",
          description: "Fasce e moduli",
          icon: LayoutGrid,
        },
        {
          href: "/admin/staff",
          label: "Staff",
          description: "Ruoli tecnici",
          icon: UserRound,
        },
        ...(canViewFinance
          ? [
              {
                href: "/admin/finanze",
                label: "Finanze",
                description: "Pagamenti e ricevute",
                icon: Wallet,
              },
            ]
          : []),
        ...(isAdmin
          ? [
              {
                href: "/admin/schedina",
                label: "Schedina",
                description: "Pronostici 1X2",
                icon: Trophy,
              },
            ]
          : []),
        {
          href: "/admin/associazioni-genitori",
          label: "Associazioni",
          description: "Secondo genitore",
          icon: Link2,
        },
        {
          href: "/admin/utenti",
          label: "Utenti",
          description: "Account e password",
          icon: UserRound,
        },
        {
          href: "/admin/comunicazioni",
          label: "Comunicazioni",
          description: "Bacheca avvisi",
          icon: Megaphone,
        },
        {
          href: "/admin/media",
          label: "Media",
          description: "Foto e video",
          icon: Images,
        },
        {
          href: "/admin/visite-mediche",
          label: "Visite mediche",
          description: "Scadenze sanitarie",
          icon: HeartPulse,
        },
        {
          href: "/admin/documenti",
          label: "Documenti",
          description: "Archivio pratiche",
          icon: FileWarning,
        },
      ];

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 md:gap-5">
        <AdminDashboardHero
          userName={
            session.user.name ?? (isYouthDirector ? "Direttore settore" : "Amministratore")
          }
          seasonLabel={seasonLabel}
          title={isYouthDirector ? "Settore giovanile" : undefined}
          subtitle={
            isYouthDirector
              ? "Gestisci atleti, attività e scadenze del settore giovanile."
              : undefined
          }
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {kpiCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                {card.title}
              </p>
              <p className={`mt-2 text-3xl font-black tracking-tight ${card.valueTone}`}>
                {card.value}
              </p>
              <p className="mt-1 text-xs text-zinc-600">{card.description}</p>
            </Link>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-950 to-sky-800 px-4 py-3 text-white">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em]">Da gestire</h2>
              <p className="mt-0.5 text-xs text-sky-200">
                {isYouthDirector
                  ? "Priorità operative del settore giovanile"
                  : "Priorità operative della società"}
              </p>
            </div>
          </div>

          <div
            className={`grid gap-3 p-4 lg:grid-cols-2 ${
              isYouthDirector ? "xl:grid-cols-3" : "xl:grid-cols-4"
            }`}
          >
            {canViewFinance ? (
              <article className="flex flex-col rounded-2xl border border-sky-200 bg-sky-50/60 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-800 text-white">
                      <Wallet className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">Pagamenti aperti</h3>
                      <p className="text-[11px] text-zinc-600">Pending e overdue</p>
                    </div>
                  </div>
                  <Link
                    href="/admin/finanze"
                    className="rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-xs font-bold text-sky-950 hover:bg-sky-50"
                  >
                    Apri
                  </Link>
                </div>
                <div className="mt-3 space-y-1.5">
                  <p className="text-2xl font-black text-blue-950">{pendingPaymentsCount}</p>
                  <p className="text-xs font-semibold text-sky-900">
                    Totale {euroFormatter.format(pendingPaymentsAmount ?? 0)}
                  </p>
                </div>
              </article>
            ) : null}

            <article className="flex flex-col rounded-2xl border border-red-200 bg-red-50/50 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-700 text-white">
                    <HeartPulse className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Certificati medici</h3>
                    <p className="text-[11px] text-zinc-600">Scaduti o in scadenza</p>
                  </div>
                </div>
                <Link
                  href="/admin/visite-mediche"
                  className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-bold text-red-800 hover:bg-red-50"
                >
                  Apri
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-sky-200 bg-white px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-sky-900">
                    In scadenza
                  </p>
                  <p className="mt-0.5 text-xl font-black text-sky-950">
                    {reminderTargets.expiring.length}
                  </p>
                </div>
                <div className="rounded-xl border border-red-200 bg-white px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">
                    Scadute
                  </p>
                  <p className="mt-0.5 text-xl font-black text-red-800">
                    {reminderTargets.expired.length}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                Totale alert: {medicalAlertCount}
              </p>
              {isAdmin ? (
                <div className="mt-3">
                  <AdminMedicalVisitRemindersActions
                    expiringCount={reminderTargets.expiring.length}
                    expiredCount={reminderTargets.expired.length}
                  />
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">
                  Invio promemoria disponibile solo per admin.
                </p>
              )}
            </article>

            <article className="flex flex-col rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-800 text-white">
                    <FileWarning className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Nuove iscrizioni</h3>
                    <p className="text-[11px] text-zinc-600">Ultime pratiche ricevute</p>
                  </div>
                </div>
                <Link
                  href="/admin/atleti"
                  className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-bold text-blue-900 hover:bg-blue-50"
                >
                  Apri
                </Link>
              </div>
              {recentEnrollments.length === 0 ? (
                <p className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
                  Nessuna nuova iscrizione.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {recentEnrollments.slice(0, 3).map((enrollment) => (
                    <li
                      key={enrollment.id}
                      className="rounded-xl border border-blue-100 bg-white px-2.5 py-1.5"
                    >
                      <p className="truncate text-sm font-bold text-zinc-900">
                        {`${enrollment.athlete.firstName} ${enrollment.athlete.lastName}`.trim()}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {enrollment.athlete.category.name} ·{" "}
                        {dateFormatter.format(
                          new Date(enrollment.submittedAt ?? enrollment.createdAt),
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/admin/atleti"
                className="mt-auto pt-3 text-xs font-bold text-blue-800 hover:underline"
              >
                Vai ad atleti/iscrizioni
              </Link>
            </article>

            <article className="flex flex-col rounded-2xl border border-sky-200 bg-sky-50/50 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-700 text-white">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Convocazioni</h3>
                    <p className="text-[11px] text-zinc-600">Risposte famiglie</p>
                  </div>
                </div>
                <Link
                  href={
                    nextConvocationEvent
                      ? `/admin/eventi/${nextConvocationEvent.id}/convocazioni`
                      : "/admin"
                  }
                  className="rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-xs font-bold text-sky-950 hover:bg-sky-50"
                >
                  Apri
                </Link>
              </div>
              {nextConvocationEvent ? (
                <div className="mt-3 rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm text-zinc-700">
                  Prossima gestione su{" "}
                  <strong className="text-zinc-900">{nextConvocationEvent.title}</strong>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {dateTimeFormatter.format(new Date(nextConvocationEvent.startAt))}
                  </p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
                  Nessun evento categoria disponibile per convocazioni.
                </p>
              )}
            </article>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm xl:col-span-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-800" />
              <h2 className="text-base font-black text-zinc-900">Prossimi eventi</h2>
            </div>
            <p className="mt-1 text-xs text-zinc-600">Appuntamenti sportivi in arrivo</p>
            {upcomingPreviewEvents.length === 0 ? (
              <p className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                Nessun evento imminente.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcomingPreviewEvents.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-xl border border-blue-100 bg-slate-50 px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold text-zinc-900">{event.title}</p>
                    <p className="text-xs text-zinc-600">
                      {formatEventType(event.type)} · {event.category?.name ?? "Senza categoria"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {dateTimeFormatter.format(new Date(event.startAt))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm xl:col-span-1">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-blue-800" />
              <h2 className="text-base font-black text-zinc-900">Partite e allenamenti</h2>
            </div>
            <p className="mt-1 text-xs text-zinc-600">Prossimi impegni suddivisi per tipo</p>
            <div className="mt-3 grid gap-3">
              <div>
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-800">
                  <Trophy className="h-3.5 w-3.5" />
                  Partite
                </p>
                {upcomingMatches.length === 0 ? (
                  <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                    Nessuna partita imminente.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {upcomingMatches.map((event) => (
                      <li
                        key={event.id}
                        className="rounded-lg border border-blue-100 bg-slate-50 px-2.5 py-2"
                      >
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {event.title}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {event.category?.name ?? "—"} ·{" "}
                          {dateTimeFormatter.format(new Date(event.startAt))}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-800">
                  <Dumbbell className="h-3.5 w-3.5" />
                  Allenamenti
                </p>
                {upcomingTrainings.length === 0 ? (
                  <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                    Nessun allenamento imminente.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {upcomingTrainings.map((event) => (
                      <li
                        key={event.id}
                        className="rounded-lg border border-sky-100 bg-sky-50/60 px-2.5 py-2"
                      >
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {event.title}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {event.category?.name ?? "—"} ·{" "}
                          {dateTimeFormatter.format(new Date(event.startAt))}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm xl:col-span-1">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-blue-800" />
              <h2 className="text-base font-black text-zinc-900">Comunicazioni recenti</h2>
            </div>
            <p className="mt-1 text-xs text-zinc-600">Ultimi avvisi in bacheca</p>
            {recentAnnouncements.length === 0 ? (
              <p className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                Nessuna comunicazione recente.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentAnnouncements.map((announcement) => (
                  <li
                    key={announcement.id}
                    className="rounded-xl border border-blue-100 bg-slate-50 px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold text-zinc-900">{announcement.title}</p>
                    <p className="text-xs text-zinc-600">
                      {ANNOUNCEMENT_AUDIENCE_LABEL[announcement.audience]}
                      {announcement.category?.name
                        ? ` · ${announcement.category.name}`
                        : " · Generale"}
                    </p>
                    <p className="text-xs text-zinc-500">
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
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-base font-black text-zinc-900">Azioni rapide</h2>
            <p className="text-xs text-zinc-600">Collegamenti alle aree operative principali</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-[4.5rem] items-start gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-white shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-blue-950">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-zinc-600">{item.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {nextAttendanceEvent ? (
          <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-slate-900">Presenze evento</h2>
            <p className="mt-1 text-sm text-slate-600">
              Apri rapidamente l&apos;evento più vicino per verificare o aggiornare l&apos;appello.
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-800">
              {nextAttendanceEvent.title}
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
          events={upcomingEventsWithDelete}
          emptyMessage="Nessun evento pianificato al momento."
          attendanceBasePath="/admin/eventi"
          convocationBasePath="/admin/eventi"
          editBasePath="/admin/eventi"
          eventDeleteEndpointBase="/api/events"
        />
      </div>
    </main>
  );
}
