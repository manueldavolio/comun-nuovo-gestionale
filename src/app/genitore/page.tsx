import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Camera,
  ClipboardList,
  FileText,
  HeartPulse,
  Wallet,
} from "lucide-react";
import { AreaHeader } from "@/components/layout/area-header";
import { StatusBadge } from "@/components/layout/status-badge";
import { PaymentActions } from "@/components/payments/payment-actions";
import { AthleteHeroCard } from "@/components/parent-dashboard/athlete-hero-card";
import { ParentChildSwitcher } from "@/components/parent-dashboard/child-switcher";
import { getAuthSession } from "@/lib/auth";
import {
  formatConvocationWallClockDate,
  formatConvocationWallClockTime,
  resolveMeetingAt,
} from "@/lib/convocation-times";
import { DOCUMENT_TYPE_LABEL } from "@/lib/document-types";
import { COACH_VISIBLE_EVENT_TYPES, EVENT_TYPE_LABEL } from "@/lib/events";
import { computeExpiryBadgeStatus, computeMedicalVisitStatus } from "@/lib/expiry-status";
import { athletesAssociatedToParentWhere } from "@/lib/parent-athletes";
import {
  computeSeasonAthleteStats,
  computeSeasonBadges,
  currentSeasonRange,
  formatMatchResultLabel,
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
      <main className="min-h-screen bg-sky-50 p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
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
  const season = currentSeasonRange(now);
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
        startAt: { gte: now },
        type: { in: COACH_VISIBLE_EVENT_TYPES },
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
        startAt: { gte: season.start, lte: season.end, lt: now },
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
      select: { content: true, year: true, month: true, updatedAt: true },
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
          event: { startAt: { gte: now } },
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

  const quickActions = [
    {
      href: "/genitore/convocazioni",
      label: "Convocazioni",
      icon: ClipboardList,
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      badge: pendingConvocationsCount > 0 ? pendingConvocationsCount : null,
    },
    {
      href: "/genitore/calendario",
      label: "Calendario",
      icon: CalendarDays,
      tone: "border-blue-200 bg-sky-50 text-blue-900",
      badge: null,
    },
    {
      href: "#documenti",
      label: "Documenti",
      icon: FileText,
      tone: "border-blue-200 bg-white text-blue-900",
      badge: null,
    },
    {
      href: "#visita-medica",
      label: "Certificato",
      icon: HeartPulse,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      badge: null,
    },
    {
      href: "/genitore/media",
      label: "Foto",
      icon: Camera,
      tone: "border-blue-200 bg-sky-50 text-blue-900",
      badge: null,
    },
    ...(isPrimaryParent
      ? [
          {
            href: "#pagamenti",
            label: "Pagamenti",
            icon: Wallet,
            tone: "border-blue-200 bg-blue-50 text-blue-900",
            badge: null as number | null,
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen bg-sky-50 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
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

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
            Prossimo impegno
          </p>
          {nextEvent ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold uppercase text-blue-800">
                  {EVENT_TYPE_LABEL[nextEvent.type]}
                </span>
                {isMatchEventType(nextEvent.type) && nextEventConvocation ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase text-emerald-800">
                    Convocato
                  </span>
                ) : null}
              </div>
              <h3 className="text-xl font-bold text-zinc-900">
                {nextEvent.opponentName?.trim()
                  ? `${isMatchEventType(nextEvent.type) ? "vs " : ""}${nextEvent.opponentName}`
                  : nextEvent.title}
              </h3>
              <p className="text-sm text-zinc-700">
                {formatConvocationWallClockDate(nextEvent.startAt)} · ore{" "}
                {formatConvocationWallClockTime(nextEvent.startAt)}
                {nextEvent.location ? ` · ${nextEvent.location}` : ""}
              </p>
              {nextEventMeetingAt && nextEventConvocation ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <p>Convocazione alle {formatConvocationWallClockTime(nextEventMeetingAt)}</p>
                  <p>Partita alle {formatConvocationWallClockTime(nextEvent.startAt)}</p>
                  <p className="mt-1 font-semibold">
                    Risposta: {RESPONSE_LABEL[nextEventConvocation.responseStatus] ?? "—"}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">Nessun impegno in programma.</p>
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
            La sua stagione
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { label: "Presenze", value: String(seasonStats.matchPresences) },
              { label: "Gol", value: String(seasonStats.goals) },
              { label: "Assist", value: String(seasonStats.assists) },
              {
                label: "Allenamenti %",
                value:
                  seasonStats.trainingPercent == null
                    ? "—"
                    : `${seasonStats.trainingPercent}%`,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-sky-100 bg-sky-50/80 px-3 py-4 text-center"
              >
                <p className="text-3xl font-bold tracking-tight text-blue-800">{kpi.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  {kpi.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {badges.length > 0 ? (
          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              Traguardi
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge.id}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
            Ultimi risultati
          </p>
          {recentResults.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nessun risultato disponibile.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentResults.map((event) => {
                const label = formatMatchResultLabel({
                  opponentName: event.opponentName,
                  homeScore: event.homeScore,
                  awayScore: event.awayScore,
                  isHome: event.isHome,
                  fallbackTitle: event.title,
                });
                return (
                  <li
                    key={event.id}
                    className="rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-zinc-900">{label}</p>
                    <p className="text-xs text-zinc-500">
                      {formatConvocationWallClockDate(event.startAt)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
            Messaggio del mister
          </p>
          {latestNote ? (
            <div className="mt-2 rounded-xl border border-blue-50 bg-slate-50 px-3 py-3">
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{latestNote.content}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {String(latestNote.month).padStart(2, "0")}/{latestNote.year}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">Nessuna nota privata al momento.</p>
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              Ultime foto
            </p>
            <Link href="/genitore/media" className="text-xs font-semibold text-blue-700">
              Vedi tutte
            </Link>
          </div>
          {recentMedia.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nessuna foto recente.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {recentMedia.map((item) => {
                const source = item.mediaUrl || item.filePath;
                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-sky-100 bg-sky-50"
                  >
                    {source && item.mediaUrl ? (
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
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
            Azioni rapide
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className={`relative flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold ${action.tone}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{action.label}</span>
                  {action.badge ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                      {action.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Area amministrativa
              </p>
              <h3 className="text-base font-semibold text-zinc-900">
                Iscrizione, documenti e scadenze
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/genitore/iscrizione/nuova"
                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Nuova iscrizione
              </Link>
              <Link
                href="/genitore/associa-figlio"
                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Associa figlio
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
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
              <div id="pagamenti" className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <p className="text-sm font-semibold text-zinc-900">Pagamenti</p>
                <div className="mt-2 space-y-2">
                  {[
                    { label: "Acconto", payment: deposit },
                    { label: "Saldo", payment: balance },
                  ].map(({ label, payment }) => (
                    <div key={label} className="rounded-lg border border-zinc-200 bg-white p-3">
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
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-600">
                I pagamenti sono gestiti dal genitore principale.
              </div>
            )}

            <div id="visita-medica" className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
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

            <div id="documenti" className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
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
                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5"
                      >
                        <span>{DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}</span>
                        <StatusBadge status={status} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
