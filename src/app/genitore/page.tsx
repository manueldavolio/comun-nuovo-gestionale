import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Award,
  CalendarDays,
  Camera,
  ClipboardList,
  FileText,
  Goal,
  Handshake,
  HeartPulse,
  MapPin,
  MessageSquareQuote,
  Percent,
  Shirt,
  Wallet,
} from "lucide-react";
import { AreaHeader } from "@/components/layout/area-header";
import { StatusBadge } from "@/components/layout/status-badge";
import { PaymentActions } from "@/components/payments/payment-actions";
import { AthleteHeroCard } from "@/components/parent-dashboard/athlete-hero-card";
import { ParentAdminPanel } from "@/components/parent-dashboard/parent-admin-panel";
import { ParentChildSwitcher } from "@/components/parent-dashboard/child-switcher";
import { getAuthSession } from "@/lib/auth";
import {
  formatConvocationWallClockDate,
  formatConvocationWallClockTime,
  resolveMeetingAt,
} from "@/lib/convocation-times";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { DOCUMENT_TYPE_LABEL } from "@/lib/document-types";
import { COACH_VISIBLE_EVENT_TYPES, EVENT_TYPE_LABEL } from "@/lib/events";
import { computeExpiryBadgeStatus, computeMedicalVisitStatus } from "@/lib/expiry-status";
import { athletesAssociatedToParentWhere } from "@/lib/parent-athletes";
import {
  computeSeasonAthleteStats,
  computeSeasonBadges,
  currentSeasonRange,
  isMatchEventType,
  MATCH_EVENT_TYPES,
} from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";

type ParentDashboardPageProps = {
  searchParams: Promise<{ enrolled?: string; athleteId?: string; stripe?: string }>;
};

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Bozza",
  SUBMITTED: "Inviata",
  APPROVED: "Approvata",
  REJECTED: "Rifiutata",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Da pagare",
  PAID: "Pagato",
  OVERDUE: "Scaduto",
  CANCELLED: "Annullato",
  FAILED: "Fallito",
  EXPIRED: "Scaduto",
};

const ENROLLMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-800",
  SUBMITTED: "border-amber-200 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-zinc-200 bg-zinc-50 text-zinc-700",
  FAILED: "border-red-200 bg-red-50 text-red-700",
  EXPIRED: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const RESPONSE_LABEL: Record<string, string> = {
  PENDING: "In attesa",
  PRESENT: "Confermato",
  ABSENT: "Assente",
};

const MONTH_LABELS = [
  "",
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const WEEKDAY_LABELS = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function statusClass(
  palette: Record<string, string>,
  status: string | null,
  fallback: string = "border-zinc-200 bg-zinc-50 text-zinc-700",
) {
  if (!status) return fallback;
  return palette[status] ?? fallback;
}

function isOpenPaymentStatus(status: string | null | undefined) {
  return ["PENDING", "OVERDUE", "CANCELLED", "FAILED", "EXPIRED"].includes(status ?? "");
}

function matchOutcome(input: {
  homeScore: number;
  awayScore: number;
  isHome: boolean | null;
}): "VITTORIA" | "PAREGGIO" | "SCONFITTA" {
  const clubIsHome = input.isHome !== false;
  const clubScore = clubIsHome ? input.homeScore : input.awayScore;
  const opponentScore = clubIsHome ? input.awayScore : input.homeScore;
  if (clubScore > opponentScore) return "VITTORIA";
  if (clubScore < opponentScore) return "SCONFITTA";
  return "PAREGGIO";
}

export default async function ParentDashboardPage({ searchParams }: ParentDashboardPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const showEnrollmentSuccess = params.enrolled === "1";

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!parentProfile) {
    redirect("/unauthorized");
  }

  const associatedAthletes = await prisma.athlete.findMany({
    where: athletesAssociatedToParentWhere(parentProfile.id),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentId: true,
      position: true,
      shirtNumber: true,
      category: { select: { id: true, name: true } },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, title: true, expiryDate: true },
      },
      medicalVisits: {
        orderBy: { visitDate: "desc" },
        take: 1,
        select: {
          id: true,
          visitDate: true,
          expiryDate: true,
          notes: true,
          certificateFilePath: true,
        },
      },
      enrollments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          seasonLabel: true,
          status: true,
          createdAt: true,
          documents: {
            where: { type: "ATHLETE_PORTRAIT" },
            select: { id: true },
            take: 1,
          },
          payments: {
            select: {
              id: true,
              type: true,
              status: true,
              receipt: { select: { id: true, filePath: true } },
            },
          },
        },
      },
    },
  });

  if (associatedAthletes.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-sky-100 via-sky-50 to-blue-50 p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
          <AreaHeader
            title="Area Genitore"
            subtitle="Dashboard famiglia ASD Comun Nuovo"
            userName={session.user.name ?? "Genitore"}
          />
          <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Nessun figlio collegato</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Inizia con una nuova iscrizione oppure associa un figlio già iscritto.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/genitore/iscrizione/nuova"
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Nuova iscrizione
              </Link>
              <Link
                href="/genitore/associa-figlio"
                className="rounded-xl border border-blue-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-sky-100"
              >
                Associa figlio
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const requestedAthleteId = (params.athleteId ?? "").trim();
  const selectedAthlete =
    associatedAthletes.find((athlete) => athlete.id === requestedAthleteId) ??
    associatedAthletes[0];

  const isPrimaryParent = selectedAthlete.parentId === parentProfile.id;
  const now = new Date();
  const wallNow = nowAsEuropeRomeWallClockUtc(now);
  const season = currentSeasonRange(wallNow);
  const latestEnrollment = selectedAthlete.enrollments[0];
  const portraitDocumentId =
    selectedAthlete.enrollments.find((enrollment) => enrollment.documents[0])?.documents[0]?.id ??
    null;
  const deposit = latestEnrollment?.payments.find((payment) => payment.type === "DEPOSIT") ?? null;
  const balance = latestEnrollment?.payments.find((payment) => payment.type === "BALANCE") ?? null;
  const medicalVisit = selectedAthlete.medicalVisits[0] ?? null;
  const medicalVisitStatus = medicalVisit
    ? computeMedicalVisitStatus(medicalVisit.expiryDate, now)
    : null;

  const [
    attendances,
    matchStats,
    nextEvent,
    recentResults,
    latestNote,
    recentMedia,
    pendingConvocationsCount,
  ] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        athleteId: selectedAthlete.id,
        event: {
          startAt: { gte: season.start, lte: season.end },
          type: { in: COACH_VISIBLE_EVENT_TYPES },
        },
      },
      select: {
        status: true,
        event: { select: { type: true } },
      },
    }),
    prisma.matchPlayerStat.findMany({
      where: {
        athleteId: selectedAthlete.id,
        event: {
          startAt: { gte: season.start, lte: season.end },
          type: { in: MATCH_EVENT_TYPES },
        },
      },
      select: { goals: true, assists: true },
    }),
    prisma.event.findFirst({
      where: {
        categoryId: selectedAthlete.category.id,
        type: { in: COACH_VISIBLE_EVENT_TYPES },
        OR: [
          { endAt: { gte: wallNow } },
          { AND: [{ endAt: null }, { startAt: { gte: wallNow } }] },
        ],
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        startAt: true,
        location: true,
        opponentName: true,
        convocation: {
          select: {
            meetingAt: true,
            athletes: {
              where: { athleteId: selectedAthlete.id },
              select: { responseStatus: true },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.event.findMany({
      where: {
        categoryId: selectedAthlete.category.id,
        type: { in: MATCH_EVENT_TYPES },
        startAt: { gte: season.start, lte: season.end, lt: wallNow },
        homeScore: { not: null },
        awayScore: { not: null },
      },
      orderBy: { startAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        opponentName: true,
        homeScore: true,
        awayScore: true,
        isHome: true,
        startAt: true,
      },
    }),
    prisma.athleteCoachNote.findFirst({
      where: { athleteId: selectedAthlete.id },
      orderBy: [{ year: "desc" }, { month: "desc" }, { updatedAt: "desc" }],
      select: {
        content: true,
        year: true,
        month: true,
        updatedAt: true,
        author: { select: { name: true } },
      },
    }),
    prisma.mediaItem.findMany({
      where: {
        categoryId: selectedAthlete.category.id,
        publishedAt: { not: null, lte: now },
        mediaType: "PHOTO",
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 4,
      select: {
        id: true,
        title: true,
        mediaUrl: true,
        filePath: true,
        publishedAt: true,
      },
    }),
    prisma.convocationAthlete.count({
      where: {
        athleteId: selectedAthlete.id,
        responseStatus: "PENDING",
        convocation: {
          event: {
            OR: [
              { endAt: { gte: wallNow } },
              { AND: [{ endAt: null }, { startAt: { gte: wallNow } }] },
            ],
          },
        },
      },
    }),
  ]);

  const seasonStats = computeSeasonAthleteStats({
    attendances: attendances.map((row) => ({
      status: row.status,
      eventType: row.event.type,
    })),
    matchStats,
  });
  const badges = computeSeasonBadges(seasonStats);

  const nextEventConvocation = nextEvent?.convocation?.athletes[0] ?? null;
  const nextEventMeetingAt =
    nextEvent?.convocation != null
      ? resolveMeetingAt(nextEvent.convocation.meetingAt, nextEvent.startAt)
      : null;
  const nextWeekday = nextEvent ? WEEKDAY_LABELS[nextEvent.startAt.getUTCDay()] : null;
  const nextDay = nextEvent ? String(nextEvent.startAt.getUTCDate()).padStart(2, "0") : null;
  const nextMonth = nextEvent
    ? String(nextEvent.startAt.getUTCMonth() + 1).padStart(2, "0")
    : null;

  const responseStatus = nextEventConvocation?.responseStatus ?? null;
  const convocationTone =
    responseStatus === "PRESENT"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : responseStatus === "ABSENT"
        ? "border-red-200 bg-red-50 text-red-800"
        : responseStatus === "PENDING"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-sky-200 bg-sky-50 text-sky-900";

  const openPaymentsCount = [deposit, balance].filter((payment) =>
    isOpenPaymentStatus(payment?.status),
  ).length;
  const medicalNeedsAttention =
    !medicalVisit ||
    medicalVisitStatus === "EXPIRING" ||
    medicalVisitStatus === "EXPIRED";
  const adminHasAttention =
    medicalNeedsAttention || (isPrimaryParent && openPaymentsCount > 0);
  const adminSummaryParts: string[] = [];
  if (medicalVisitStatus === "EXPIRED") adminSummaryParts.push("visita medica scaduta");
  else if (medicalVisitStatus === "EXPIRING") adminSummaryParts.push("visita medica in scadenza");
  else if (!medicalVisit) adminSummaryParts.push("visita medica mancante");
  if (isPrimaryParent && openPaymentsCount > 0) {
    adminSummaryParts.push(
      `${openPaymentsCount} pagament${openPaymentsCount === 1 ? "o" : "i"} da completare`,
    );
  }
  const adminSummaryText =
    adminSummaryParts.length > 0
      ? adminSummaryParts.join(" · ")
      : "Tutto in ordine. Tocca per dettagli.";

  const kpiItems = [
    {
      label: "Presenze",
      value: String(seasonStats.matchPresences),
      icon: Shirt,
      tone: "border-blue-200 bg-blue-50",
      iconTone: "bg-blue-700 text-white",
      valueTone: "text-blue-800",
    },
    {
      label: "Gol",
      value: String(seasonStats.goals),
      icon: Goal,
      tone: "border-sky-200 bg-sky-50",
      iconTone: "bg-sky-600 text-white",
      valueTone: "text-sky-900",
    },
    {
      label: "Assist",
      value: String(seasonStats.assists),
      icon: Handshake,
      tone: "border-slate-200 bg-slate-50",
      iconTone: "bg-slate-700 text-white",
      valueTone: "text-slate-900",
    },
    {
      label: "Allenamenti %",
      value:
        seasonStats.trainingPercent == null ? "—" : `${seasonStats.trainingPercent}%`,
      icon: Percent,
      tone: "border-emerald-200 bg-emerald-50",
      iconTone: "bg-emerald-700 text-white",
      valueTone: "text-emerald-900",
    },
  ];

  const quickActions = [
    {
      href: "/genitore/convocazioni",
      label: "Convocazioni",
      icon: ClipboardList,
      tone: "border-amber-200 bg-amber-50 text-amber-950",
      iconWrap: "bg-amber-500 text-white",
      badge: pendingConvocationsCount > 0 ? pendingConvocationsCount : null,
    },
    {
      href: "/genitore/calendario",
      label: "Calendario",
      icon: CalendarDays,
      tone: "border-blue-200 bg-sky-50 text-blue-950",
      iconWrap: "bg-blue-700 text-white",
      badge: null,
    },
    {
      href: "#documenti",
      label: "Documenti",
      icon: FileText,
      tone: "border-blue-100 bg-white text-blue-950",
      iconWrap: "bg-blue-600 text-white",
      badge: null,
    },
    {
      href: "#visita-medica",
      label: "Certificato",
      icon: HeartPulse,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
      iconWrap: "bg-emerald-600 text-white",
      badge: null,
    },
    {
      href: "/genitore/media",
      label: "Foto",
      icon: Camera,
      tone: "border-sky-200 bg-sky-50 text-sky-950",
      iconWrap: "bg-sky-600 text-white",
      badge: null,
    },
    ...(isPrimaryParent
      ? [
          {
            href: "#pagamenti",
            label: "Pagamenti",
            icon: Wallet,
            tone: "border-blue-200 bg-blue-50 text-blue-950",
            iconWrap: "bg-blue-800 text-white",
            badge: openPaymentsCount > 0 ? openPaymentsCount : (null as number | null),
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 via-sky-50 to-blue-50 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 md:gap-5">
        <AreaHeader
          title="Area Genitore"
          subtitle="Dashboard sportiva famiglia"
          userName={session.user.name ?? "Genitore"}
        />

        {showEnrollmentSuccess ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
            Iscrizione inviata correttamente. Le scadenze economiche sono state generate.
          </p>
        ) : null}

        <ParentChildSwitcher
          childrenOptions={associatedAthletes.map((athlete) => ({
            id: athlete.id,
            firstName: athlete.firstName,
            lastName: athlete.lastName,
          }))}
          selectedId={selectedAthlete.id}
        />

        <AthleteHeroCard
          firstName={selectedAthlete.firstName}
          lastName={selectedAthlete.lastName}
          categoryName={selectedAthlete.category.name}
          position={selectedAthlete.position}
          shirtNumber={selectedAthlete.shirtNumber}
          portraitUrl={
            portraitDocumentId
              ? `/api/genitore/enrollment-documents/${portraitDocumentId}/download`
              : null
          }
        />

        <div className="grid gap-4 lg:grid-cols-5 lg:gap-5">
          <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm lg:col-span-3">
            <div className="flex items-center justify-between gap-3 bg-blue-800 px-4 py-3 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Prossimo impegno</p>
              {nextEvent ? (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase">
                  {EVENT_TYPE_LABEL[nextEvent.type]}
                </span>
              ) : null}
            </div>

            {nextEvent ? (
              <div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-start">
                <div className="flex w-full flex-row items-center gap-3 rounded-2xl bg-sky-50 px-4 py-3 sm:w-28 sm:flex-col sm:justify-center sm:px-3 sm:py-4">
                  <p className="text-xs font-semibold uppercase text-blue-700">{nextWeekday}</p>
                  <p className="text-4xl font-black leading-none text-blue-800">{nextDay}</p>
                  <p className="text-sm font-semibold text-blue-700">/{nextMonth}</p>
                </div>

                <div className="min-w-0 space-y-3">
                  <div>
                    <h3 className="text-xl font-bold leading-tight text-zinc-900 sm:text-2xl">
                      {nextEvent.opponentName?.trim()
                        ? isMatchEventType(nextEvent.type)
                          ? `vs ${nextEvent.opponentName}`
                          : nextEvent.opponentName
                        : nextEvent.title}
                    </h3>
                    {!nextEvent.opponentName?.trim() ? null : (
                      <p className="mt-1 text-sm text-zinc-500">{nextEvent.title}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-700">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <CalendarDays className="h-4 w-4 text-blue-700" aria-hidden />
                      {formatConvocationWallClockDate(nextEvent.startAt)} ·{" "}
                      {formatConvocationWallClockTime(nextEvent.startAt)}
                    </span>
                    {nextEvent.location ? (
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <MapPin className="h-4 w-4 text-blue-700" aria-hidden />
                        {nextEvent.location}
                      </span>
                    ) : null}
                  </div>

                  {nextEventConvocation ? (
                    <div className={`rounded-xl border px-3 py-2.5 text-sm ${convocationTone}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        {isMatchEventType(nextEvent.type) ? (
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold uppercase">
                            Convocato
                          </span>
                        ) : null}
                        <span className="font-semibold">
                          {RESPONSE_LABEL[nextEventConvocation.responseStatus] ?? "—"}
                        </span>
                      </div>
                      {nextEventMeetingAt ? (
                        <p className="mt-1.5">
                          Convocazione alle{" "}
                          <strong>{formatConvocationWallClockTime(nextEventMeetingAt)}</strong>
                          {" · "}
                          Partita alle{" "}
                          <strong>{formatConvocationWallClockTime(nextEvent.startAt)}</strong>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="px-4 py-5 text-sm text-zinc-600">Nessun impegno in programma.</p>
            )}
          </section>

          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800">
              La sua stagione
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {kpiItems.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <div
                    key={kpi.label}
                    className={`rounded-2xl border px-3 py-3 ${kpi.tone}`}
                  >
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${kpi.iconTone}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <p className={`mt-2 text-3xl font-black tracking-tight ${kpi.valueTone}`}>
                      {kpi.value}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                      {kpi.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {badges.length > 0 ? (
          <section className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
              Traguardi
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-white px-3 py-2.5 shadow-sm"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Award className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="text-sm font-semibold text-zinc-900">{badge.label}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {recentResults.length > 0 ? (
          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800">
              Ultimi risultati
            </p>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {recentResults.map((event) => {
                const homeScore = event.homeScore ?? 0;
                const awayScore = event.awayScore ?? 0;
                const clubIsHome = event.isHome !== false;
                const leftName = clubIsHome
                  ? "Comun Nuovo"
                  : event.opponentName?.trim() || "Avversario";
                const rightName = clubIsHome
                  ? event.opponentName?.trim() || "Avversario"
                  : "Comun Nuovo";
                const outcome = matchOutcome({
                  homeScore,
                  awayScore,
                  isHome: event.isHome,
                });
                const outcomeClass =
                  outcome === "VITTORIA"
                    ? "bg-emerald-100 text-emerald-800"
                    : outcome === "SCONFITTA"
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-100 text-slate-700";

                return (
                  <li
                    key={event.id}
                    className="rounded-2xl border border-sky-100 bg-sky-50/70 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <span>{formatConvocationWallClockDate(event.startAt)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${outcomeClass}`}
                      >
                        {outcome}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <p className="truncate text-right text-sm font-bold uppercase text-zinc-900">
                        {leftName}
                      </p>
                      <p className="rounded-lg bg-blue-800 px-2.5 py-1 text-center text-sm font-black text-white">
                        {homeScore} - {awayScore}
                      </p>
                      <p className="truncate text-left text-sm font-bold uppercase text-zinc-900">
                        {rightName}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {latestNote ? (
          <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-800 text-white">
                <MessageSquareQuote className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800">
                  Messaggio del mister
                </p>
                <p className="mt-1 text-xs font-medium text-blue-700">
                  {MONTH_LABELS[latestNote.month] ?? latestNote.month} {latestNote.year}
                  {latestNote.author.name ? ` · ${latestNote.author.name}` : ""}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                  {latestNote.content}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {recentMedia.length > 0 ? (
          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800">
                Ultime foto
              </p>
              <Link
                href="/genitore/media"
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Vedi tutte
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {recentMedia.map((item) => {
                const source = item.mediaUrl || item.filePath;
                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-sky-100 bg-sky-50"
                  >
                    {source ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={source}
                        alt={item.title}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-blue-100 px-2 text-center text-xs font-semibold text-blue-800">
                        {item.title}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800">
            Azioni rapide
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className={`relative flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center text-sm font-semibold transition hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${action.tone}`}
                >
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${action.iconWrap}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>{action.label}</span>
                  {action.badge ? (
                    <span className="absolute right-2 top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                      {action.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>

        <ParentAdminPanel summaryText={adminSummaryText} hasAttention={adminHasAttention}>
          <div className="mb-1 flex flex-wrap gap-2">
            <Link
              href="/genitore/iscrizione/nuova"
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-slate-50"
            >
              Nuova iscrizione
            </Link>
            <Link
              href="/genitore/associa-figlio"
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-slate-50"
            >
              Associa figlio
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900">Iscrizione</p>
              <span
                className={[
                  "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                  statusClass(ENROLLMENT_STATUS_COLORS, latestEnrollment?.status ?? null),
                ].join(" ")}
              >
                {latestEnrollment?.status
                  ? ENROLLMENT_STATUS_LABEL[latestEnrollment.status] ?? latestEnrollment.status
                  : "Non disponibile"}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Stagione: {latestEnrollment?.seasonLabel ?? "—"}
            </p>
          </div>

          {isPrimaryParent ? (
            <div id="pagamenti" className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-zinc-900">Pagamenti</p>
              <div className="mt-2 space-y-2">
                {[
                  { label: "Acconto", payment: deposit },
                  { label: "Saldo", payment: balance },
                ].map(({ label, payment }) => (
                  <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-900">{label}</p>
                      <span
                        className={[
                          "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                          statusClass(PAYMENT_STATUS_COLORS, payment?.status ?? null),
                        ].join(" ")}
                      >
                        {payment
                          ? PAYMENT_STATUS_LABEL[payment.status] ?? payment.status
                          : "Non generato"}
                      </span>
                    </div>
                    {payment && (payment.type === "DEPOSIT" || payment.type === "BALANCE") ? (
                      <div className="mt-2">
                        <PaymentActions
                          paymentId={payment.id}
                          paymentType={payment.type}
                          status={payment.status}
                          receiptId={payment.receipt?.id ?? null}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-zinc-600">
              I pagamenti sono gestiti dal genitore principale.
            </div>
          )}

          <div id="visita-medica" className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-zinc-900">Visita medica</p>
            {medicalVisit ? (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={medicalVisitStatus ?? "EXPIRED"} />
                </div>
                <p className="text-sm text-zinc-700">
                  Scadenza:{" "}
                  <span className="font-semibold">
                    {dateFormatter.format(new Date(medicalVisit.expiryDate))}
                  </span>
                </p>
                {medicalVisit.certificateFilePath ? (
                  <a
                    href={`/api/genitore/medical-visits/${medicalVisit.id}/certificate/download`}
                    className="inline-flex rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                  >
                    Scarica certificato
                  </a>
                ) : (
                  <p className="text-xs text-zinc-500">Certificato non disponibile.</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-red-700">Nessuna visita medica registrata.</p>
            )}
          </div>

          <div id="documenti" className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-zinc-900">Documenti</p>
            {selectedAthlete.documents.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600">Nessun documento caricato.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {selectedAthlete.documents.slice(0, 6).map((doc) => {
                  const status = computeExpiryBadgeStatus(doc.expiryDate, now);
                  return (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                    >
                      <span>{DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}</span>
                      <StatusBadge status={status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ParentAdminPanel>
      </div>
    </main>
  );
}
