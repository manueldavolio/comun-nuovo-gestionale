import Link from "next/link";
import { redirect } from "next/navigation";
import { AttendanceManager } from "@/components/attendance/attendance-manager";
import { getAuthSession } from "@/lib/auth";
import { canManageEventAttendance } from "@/lib/attendance";
import { isMatchEventType } from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";

type MisterAttendancePageProps = {
  params: Promise<{ id: string }>;
};

export default async function MisterAttendancePage({ params }: MisterAttendancePageProps) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/mister/eventi/${id}/presenze`);
  }

  if (
    session.user.role !== "COACH" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR"
  ) {
    redirect("/unauthorized");
  }

  const canManage = await canManageEventAttendance({
    userId: session.user.id,
    role: session.user.role,
    eventId: id,
  });

  if (!canManage) {
    redirect("/unauthorized");
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      type: true,
      startAt: true,
      location: true,
      opponentName: true,
      homeScore: true,
      awayScore: true,
      isHome: true,
      periodScores: {
        select: { periodNumber: true, homeScore: true, awayScore: true },
        orderBy: { periodNumber: "asc" },
      },
      trainingSession: { select: { id: true } },
      matchFormation: { select: { id: true } },
      category: {
        select: {
          name: true,
          athletes: {
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              shirtNumber: true,
              attendances: {
                where: { eventId: id },
                select: { status: true },
                take: 1,
              },
              matchStats: {
                where: { eventId: id },
                select: { goals: true, assists: true, goalsConceded: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!event || !event.category) {
    redirect("/unauthorized");
  }

  const matchMode = isMatchEventType(event.type);
  const trainingMode = event.type === "TRAINING";

  const athletes = event.category.athletes.map((athlete) => ({
    id: athlete.id,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    position: athlete.position,
    shirtNumber: athlete.shirtNumber,
    status: athlete.attendances[0]?.status ?? null,
    goals: athlete.matchStats[0]?.goals ?? 0,
    assists: athlete.matchStats[0]?.assists ?? 0,
    goalsConceded: athlete.matchStats[0]?.goalsConceded ?? null,
  }));

  const backHref =
    session.user.role === "ADMIN" || session.user.role === "YOUTH_DIRECTOR" ? "/admin" : "/mister";

  const hasTrainingSession = Boolean(event.trainingSession);
  const hasFormation = Boolean(event.matchFormation);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-sky-50"
        >
          ← Torna alla dashboard
        </Link>

        {trainingMode || matchMode ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {trainingMode ? (
              <Link
                href={`/mister/eventi/${event.id}/allenamento`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-bold uppercase tracking-wide text-white hover:bg-blue-900"
              >
                {hasTrainingSession ? "Vedi / modifica seduta" : "Prepara allenamento"}
              </Link>
            ) : null}
            {matchMode ? (
              <Link
                href={`/mister/eventi/${event.id}/formazione`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-bold uppercase tracking-wide text-blue-900 hover:bg-sky-50"
              >
                {hasFormation ? "Formazione" : "Formazione"}
              </Link>
            ) : null}
          </div>
        ) : null}

        <AttendanceManager
          eventId={event.id}
          eventTitle={event.title}
          eventCategoryName={event.category.name}
          eventStartAt={event.startAt}
          eventLocation={event.location}
          athletes={athletes}
          matchMode={matchMode}
          initialMatchResult={
            matchMode
              ? {
                  opponentName: event.opponentName,
                  homeScore: event.homeScore,
                  awayScore: event.awayScore,
                  isHome: event.isHome,
                }
              : undefined
          }
          initialPeriodScores={matchMode ? event.periodScores : undefined}
        />
      </div>
    </main>
  );
}
