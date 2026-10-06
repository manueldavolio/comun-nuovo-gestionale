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
import { AthleteSeasonCard } from "@/components/parent-dashboard/athlete-season-card";
import {
  AthleteRecentMatchesStrip,
  CoachNoteCard,
} from "@/components/parent-dashboard/athlete-story-cards";
import { AthleteGrowthPathSection } from "@/components/parent-dashboard/athlete-growth-path-section";
import { AthleteWeekSection } from "@/components/parent-dashboard/athlete-week-section";
import { MatchDayCard } from "@/components/parent-dashboard/match-day-card";
import { ParentAdminPanel } from "@/components/parent-dashboard/parent-admin-panel";
import { ParentChildSwitcher } from "@/components/parent-dashboard/child-switcher";
import { ParentGoalsCard } from "@/components/parent-dashboard/parent-goals-card";
import { PredictionSlipDashboardCard } from "@/components/parent-dashboard/prediction-slip-dashboard-card";
import { getAuthSession } from "@/lib/auth";
import { formatCoachNoteAuthorLabel } from "@/lib/coach-note-tags";
import {
  formatConvocationWallClockDate,
  formatConvocationWallClockTime,
  resolveMeetingAt,
} from "@/lib/convocation-times";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { DOCUMENT_TYPE_LABEL } from "@/lib/document-types";
import { COACH_VISIBLE_EVENT_TYPES, EVENT_TYPE_LABEL } from "@/lib/events";
import { computeExpiryBadgeStatus, computeMedicalVisitStatus } from "@/lib/expiry-status";
import { formatPeriodScoresDetail } from "@/lib/four-period-scoring";
import {
  resolveMatchDayPhase,
  resolveConvocationNote,
  selectTodaysMatchDayEvent,
  wallClockDayBounds,
} from "@/lib/match-day";
import {
  buildAthleteGrowthPath,
  buildRecentMatchChips,
} from "@/lib/my-comun-nuovo/achievements";
import {
  buildAthleteWeekRows,
  myComunWeekBounds,
  resolveAthleteWeekCompleted,
  summarizeWeekTrainings,
} from "@/lib/my-comun-nuovo/week";
import {
  buildParentPaymentDisplay,
  formatEuroAmount,
  resolveCategoryEnrollmentFees,
} from "@/lib/enrollment-fees";
import { athletesAssociatedToParentWhere } from "@/lib/parent-athletes";
import {
  evaluatePredictionEntry,
  resolveSlipLockState,
} from "@/lib/prediction-slip";
import { selectDashboardPredictionSlip } from "@/lib/prediction-slip-server";
import {
  computeSeasonAthleteStats,
  currentSeasonRange,
  isMatchEventType,
  MATCH_EVENT_TYPES,
} from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";
import { isGoalkeeperRole } from "@/lib/athlete-roles";

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

  const publishedSlips = await prisma.predictionSlip.findMany({
    where: { isPublished: true, effectiveClosesAt: { not: null } },
    orderBy: [{ closesAt: "desc" }],
    take: 12,
    select: {
      id: true,
      title: true,
      prizeText: true,
      closesAt: true,
      effectiveClosesAt: true,
      lockedAt: true,
      isPublished: true,
      events: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          event: {
            select: {
              homeScore: true,
              awayScore: true,
            },
          },
        },
      },
      entries: {
        where: { parentId: parentProfile.id },
        take: 1,
        select: {
          id: true,
          picks: {
            select: {
              slipEventId: true,
              choice: true,
            },
          },
        },
      },
    },
  });

  const dashboardSlipCandidate = selectDashboardPredictionSlip(
    publishedSlips.map((slip) => ({
      id: slip.id,
      title: slip.title,
      prizeText: slip.prizeText,
      closesAt: slip.closesAt,
      effectiveClosesAt: slip.effectiveClosesAt,
      lockedAt: slip.lockedAt,
      isPublished: slip.isPublished,
      hasOwnEntry: slip.entries.length > 0,
    })),
    nowAsEuropeRomeWallClockUtc(),
  );

  const dashboardSlip = dashboardSlipCandidate
    ? publishedSlips.find((slip) => slip.id === dashboardSlipCandidate.id) ?? null
    : null;

  const wallNowForSlip = nowAsEuropeRomeWallClockUtc();
  const dashboardSlipLock =
    dashboardSlip && dashboardSlip.effectiveClosesAt
      ? resolveSlipLockState({
          lockedAt: dashboardSlip.lockedAt,
          effectiveClosesAt: dashboardSlip.effectiveClosesAt,
          now: wallNowForSlip,
        })
      : null;
  const dashboardSlipEvaluation =
    dashboardSlip && dashboardSlip.entries[0]
      ? evaluatePredictionEntry({
          slipEventCount: dashboardSlip.events.length,
          picks: dashboardSlip.entries[0].picks.map((pick) => {
            const slipEvent = dashboardSlip.events.find((row) => row.id === pick.slipEventId);
            return {
              choice: pick.choice,
              homeScore: slipEvent?.event.homeScore,
              awayScore: slipEvent?.event.awayScore,
            };
          }),
        })
      : null;
  const dashboardSlipClosesLabel = dashboardSlipLock
    ? new Intl.DateTimeFormat("it-IT", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(dashboardSlipLock.effectiveClosesAt)
    : "";

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
      category: {
        select: {
          id: true,
          name: true,
          depositFee: true,
          balanceFee: true,
          annualFee: true,
        },
      },
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
              amount: true,
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
          {dashboardSlip && dashboardSlipLock ? (
            <PredictionSlipDashboardCard
              slipId={dashboardSlip.id}
              title={dashboardSlip.title}
              prizeText={dashboardSlip.prizeText}
              eventsCount={dashboardSlip.events.length}
              lockState={dashboardSlipLock.state}
              effectiveClosesAtLabel={dashboardSlipClosesLabel}
              hasEntry={dashboardSlip.entries.length > 0}
              evaluation={dashboardSlipEvaluation}
            />
          ) : null}
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
  const todayBounds = wallClockDayBounds(wallNow);
  const weekBounds = myComunWeekBounds(wallNow);
  const latestEnrollment = selectedAthlete.enrollments[0];
  const portraitDocumentId =
    selectedAthlete.enrollments.find((enrollment) => enrollment.documents[0])?.documents[0]?.id ??
    null;
  const deposit = latestEnrollment?.payments.find((payment) => payment.type === "DEPOSIT") ?? null;
  const balance = latestEnrollment?.payments.find((payment) => payment.type === "BALANCE") ?? null;

  let paymentDisplayRows: ReturnType<typeof buildParentPaymentDisplay> = [];
  let paymentFeesError: string | null = null;
  if (latestEnrollment && (deposit || balance)) {
    try {
      const fees = resolveCategoryEnrollmentFees({
        depositFee: selectedAthlete.category.depositFee,
        balanceFee: selectedAthlete.category.balanceFee,
        annualFee: selectedAthlete.category.annualFee,
      });
      paymentDisplayRows = buildParentPaymentDisplay({
        fees,
        payments: latestEnrollment.payments.map((payment) => ({
          id: payment.id,
          type: payment.type,
          status: payment.status,
          amount: payment.amount,
          receiptId: payment.receipt?.id ?? null,
        })),
      });
    } catch (error) {
      paymentFeesError =
        error instanceof Error
          ? error.message
          : "Quote categoria non configurate per i pagamenti.";
    }
  }

  const medicalVisit = selectedAthlete.medicalVisits[0] ?? null;
  const medicalVisitStatus = medicalVisit
    ? computeMedicalVisitStatus(medicalVisit.expiryDate, now)
    : null;

  const [
    attendances,
    matchStats,
    todaysMatchCandidates,
    weekEventCandidates,
    nextEventCandidates,
    recentMatches,
    latestNote,
    recentMedia,
    pendingConvocationsCount,
    personalGoals,
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
        event: { select: { type: true, startAt: true } },
      },
      orderBy: { event: { startAt: "asc" } },
    }),
    prisma.matchPlayerStat.findMany({
      where: {
        athleteId: selectedAthlete.id,
        event: {
          startAt: { gte: season.start, lte: season.end },
          type: { in: MATCH_EVENT_TYPES },
        },
      },
      select: { goals: true, assists: true, goalsConceded: true },
    }),
    prisma.event.findMany({
      where: {
        categoryId: selectedAthlete.category.id,
        type: { in: MATCH_EVENT_TYPES },
        startAt: { gte: todayBounds.start, lte: todayBounds.end },
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        startAt: true,
        endAt: true,
        location: true,
        opponentName: true,
        isHome: true,
        homeScore: true,
        awayScore: true,
        convocation: {
          select: {
            meetingAt: true,
            notes: true,
            athletes: {
              where: { athleteId: selectedAthlete.id },
              select: { responseStatus: true },
              take: 1,
            },
          },
        },
        attendances: {
          where: { athleteId: selectedAthlete.id },
          select: { status: true },
          take: 1,
        },
        matchStats: {
          where: { athleteId: selectedAthlete.id },
          select: { goals: true, assists: true },
          take: 1,
        },
        periodScores: {
          select: { periodNumber: true, homeScore: true, awayScore: true },
          orderBy: { periodNumber: "asc" },
        },
      },
    }),
    prisma.event.findMany({
      where: {
        categoryId: selectedAthlete.category.id,
        type: { in: COACH_VISIBLE_EVENT_TYPES },
        startAt: { gte: weekBounds.start, lte: weekBounds.end },
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        startAt: true,
        opponentName: true,
        isHome: true,
        attendances: {
          where: { athleteId: selectedAthlete.id },
          select: { status: true },
          take: 1,
        },
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
        type: { in: COACH_VISIBLE_EVENT_TYPES },
        OR: [
          { endAt: { gte: wallNow } },
          { AND: [{ endAt: null }, { startAt: { gte: wallNow } }] },
        ],
      },
      orderBy: { startAt: "asc" },
      take: 8,
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
            notes: true,
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
        OR: [
          { homeScore: { not: null }, awayScore: { not: null } },
          { attendances: { some: { athleteId: selectedAthlete.id } } },
        ],
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
        attendances: {
          where: { athleteId: selectedAthlete.id },
          select: { status: true },
          take: 1,
        },
        matchStats: {
          where: { athleteId: selectedAthlete.id },
          select: { goals: true, assists: true },
          take: 1,
        },
        periodScores: {
          select: { periodNumber: true, homeScore: true, awayScore: true },
          orderBy: { periodNumber: "asc" },
        },
      },
    }),
    prisma.athleteCoachNote.findFirst({
      where: {
        athleteId: selectedAthlete.id,
        year: wallNow.getUTCFullYear(),
        month: wallNow.getUTCMonth() + 1,
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        content: true,
        year: true,
        month: true,
        positiveTags: true,
        updatedAt: true,
        author: { select: { name: true, role: true } },
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
    prisma.athletePersonalGoal.findMany({
      where: { athleteId: selectedAthlete.id },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        text: true,
        status: true,
      },
    }),
  ]);

  const matchDayEvent = selectTodaysMatchDayEvent(todaysMatchCandidates, wallNow);
  const matchDayPhase = matchDayEvent
    ? resolveMatchDayPhase({
        startAt: matchDayEvent.startAt,
        endAt: matchDayEvent.endAt,
        wallNow,
      })
    : null;
  const matchDayConvocationEntry = matchDayEvent?.convocation?.athletes[0] ?? null;
  const matchDayMeetingAt =
    matchDayEvent?.convocation?.meetingAt != null
      ? resolveMeetingAt(matchDayEvent.convocation.meetingAt, matchDayEvent.startAt)
      : null;
  const matchDayPlayerStat = matchDayEvent?.matchStats[0] ?? null;
  const matchDayAttendanceStatus = matchDayEvent?.attendances[0]?.status ?? null;

  const weekRows = buildAthleteWeekRows({
    events: weekEventCandidates.map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      startAt: event.startAt,
      opponentName: event.opponentName,
      isHome: event.isHome,
      attendanceStatus: event.attendances[0]?.status ?? null,
      isConvoked: Boolean(event.convocation?.athletes[0]),
      convocationResponse: event.convocation?.athletes[0]?.responseStatus ?? null,
      meetingAt:
        event.convocation?.meetingAt != null
          ? resolveMeetingAt(event.convocation.meetingAt, event.startAt)
          : null,
    })),
    wallNow,
    excludeEventId: matchDayEvent?.id ?? null,
  });
  const weekTrainingSummary = summarizeWeekTrainings(weekRows);
  const weekCompleted = resolveAthleteWeekCompleted(weekRows);

  const nextEvent =
    nextEventCandidates.find((event) => event.id !== matchDayEvent?.id) ?? null;
  const seasonStats = computeSeasonAthleteStats({
    attendances: attendances.map((row) => ({
      status: row.status,
      eventType: row.event.type,
    })),
    matchStats,
  });
  const trainingStatusesChronological = attendances
    .filter((row) => row.event.type === "TRAINING")
    .map((row) => row.status);
  const cleanSheetCount = isGoalkeeperRole(selectedAthlete.position)
    ? matchStats.filter((row) => row.goalsConceded != null && row.goalsConceded === 0).length
    : 0;
  const growthPath = buildAthleteGrowthPath({
    stats: seasonStats,
    position: selectedAthlete.position,
    trainingStatusesChronological,
    cleanSheetCount,
  });
  const recentMatchChips = buildRecentMatchChips(
    recentMatches.map((event) => ({
      id: event.id,
      startAt: event.startAt,
      opponentName: event.opponentName,
      title: event.title,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      attendanceStatus: event.attendances[0]?.status ?? null,
      goals: event.matchStats[0]?.goals ?? 0,
      assists: event.matchStats[0]?.assists ?? 0,
    })),
  );

  const nextEventConvocation = nextEvent?.convocation?.athletes[0] ?? null;
  const nextEventMeetingAt =
    nextEvent?.convocation != null
      ? resolveMeetingAt(nextEvent.convocation.meetingAt, nextEvent.startAt)
      : null;
  const nextEventNote = resolveConvocationNote(nextEvent?.convocation?.notes);
  const weekHasNext = nextEvent ? weekRows.some((row) => row.id === nextEvent.id) : false;
  const showNextEventCard = Boolean(nextEvent && !weekHasNext && !matchDayEvent);

  const responseStatus = nextEventConvocation?.responseStatus ?? null;
  const convocationTone =
    responseStatus === "PRESENT"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : responseStatus === "ABSENT"
        ? "border-red-200 bg-red-50 text-red-800"
        : responseStatus === "PENDING"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-sky-200 bg-sky-50 text-sky-900";

  const openPaymentsCount = paymentDisplayRows.filter((row) => row.canCheckout).length;
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

        {matchDayEvent && matchDayPhase ? (
          <MatchDayCard
            phase={matchDayPhase}
            title={matchDayEvent.title}
            opponentName={matchDayEvent.opponentName}
            isHome={matchDayEvent.isHome}
            startAt={matchDayEvent.startAt}
            location={matchDayEvent.location}
            meetingAt={matchDayMeetingAt}
            isConvoked={Boolean(matchDayConvocationEntry)}
            responseStatus={matchDayConvocationEntry?.responseStatus ?? null}
            convocationNotes={matchDayEvent.convocation?.notes ?? null}
            homeScore={matchDayEvent.homeScore}
            awayScore={matchDayEvent.awayScore}
            playerGoals={matchDayPlayerStat?.goals ?? 0}
            playerAssists={matchDayPlayerStat?.assists ?? 0}
            playerPresent={
              matchDayAttendanceStatus == null
                ? null
                : matchDayAttendanceStatus === "PRESENT"
            }
            periodScoresDetail={formatPeriodScoresDetail(
              matchDayEvent.periodScores ?? [],
              matchDayEvent.isHome,
            )}
          />
        ) : null}

        {dashboardSlip && dashboardSlipLock ? (
          <PredictionSlipDashboardCard
            slipId={dashboardSlip.id}
            title={dashboardSlip.title}
            prizeText={dashboardSlip.prizeText}
            eventsCount={dashboardSlip.events.length}
            lockState={dashboardSlipLock.state}
            effectiveClosesAtLabel={dashboardSlipClosesLabel}
            hasEntry={dashboardSlip.entries.length > 0}
            evaluation={dashboardSlipEvaluation}
          />
        ) : null}

        <AthleteWeekSection
          athleteFirstName={selectedAthlete.firstName}
          rows={weekRows}
          trainingSummary={weekTrainingSummary}
          weekCompleted={weekCompleted}
        />

        {showNextEventCard && nextEvent ? (
          <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 bg-blue-800 px-4 py-3 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Prossimo impegno</p>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase">
                {EVENT_TYPE_LABEL[nextEvent.type]}
              </span>
            </div>
            <div className="space-y-2 p-4">
              <h3 className="text-lg font-bold text-zinc-900">
                {nextEvent.opponentName?.trim() && isMatchEventType(nextEvent.type)
                  ? `vs ${nextEvent.opponentName}`
                  : nextEvent.title}
              </h3>
              <p className="text-sm text-zinc-600">
                {formatConvocationWallClockDate(nextEvent.startAt)} ·{" "}
                {formatConvocationWallClockTime(nextEvent.startAt)}
              </p>
              {nextEvent.location ? (
                <p className="text-sm text-zinc-600">{nextEvent.location}</p>
              ) : null}
              {nextEventMeetingAt ? (
                <p className="text-sm text-zinc-600">
                  Convocazione {formatConvocationWallClockTime(nextEventMeetingAt)}
                </p>
              ) : null}
              {nextEventConvocation ? (
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${convocationTone}`}
                >
                  {RESPONSE_LABEL[nextEventConvocation.responseStatus] ?? "Convocato"}
                </span>
              ) : null}
              {nextEventNote ? (
                <p className="text-sm text-zinc-700">{nextEventNote}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        <AthleteSeasonCard stats={seasonStats} />

        <ParentGoalsCard goals={personalGoals} />

        <AthleteGrowthPathSection reached={growthPath.reached} next={growthPath.next} />

        {latestNote ? (
          <CoachNoteCard
            content={latestNote.content}
            year={latestNote.year}
            month={latestNote.month}
            monthLabel={MONTH_LABELS[latestNote.month] ?? String(latestNote.month)}
            authorLabel={
              formatCoachNoteAuthorLabel({
                name: latestNote.author.name,
                role: latestNote.author.role,
              }).fullLabel
            }
            positiveTags={latestNote.positiveTags}
          />
        ) : null}

        <AthleteRecentMatchesStrip chips={recentMatchChips} />

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
              {paymentFeesError ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {paymentFeesError}
                </p>
              ) : null}
              <div className="mt-2 space-y-2">
                {paymentDisplayRows.length === 0 && !paymentFeesError ? (
                  <p className="text-sm text-zinc-600">Nessuna scadenza di pagamento generata.</p>
                ) : null}
                {paymentDisplayRows.map((row) => (
                  <div
                    key={row.paymentId}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-900">{row.label}</p>
                      <span
                        className={[
                          "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
                          statusClass(PAYMENT_STATUS_COLORS, row.status),
                        ].join(" ")}
                      >
                        {PAYMENT_STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </div>
                    <div className="mt-2">
                      <PaymentActions
                        paymentId={row.paymentId}
                        paymentType={row.paymentType}
                        status={
                          row.status as
                            | "PENDING"
                            | "PAID"
                            | "OVERDUE"
                            | "CANCELLED"
                            | "FAILED"
                            | "EXPIRED"
                        }
                        receiptId={row.receiptId}
                        displayAmountLabel={formatEuroAmount(row.displayAmount)}
                        checkoutLabel={row.checkoutLabel}
                        canCheckout={row.canCheckout}
                      />
                    </div>
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
