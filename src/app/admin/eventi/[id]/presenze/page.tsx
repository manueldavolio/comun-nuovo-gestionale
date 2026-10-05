import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { AttendanceManager } from "@/components/attendance/attendance-manager";
import { getAuthSession } from "@/lib/auth";
import { canManageEventAttendance } from "@/lib/attendance";
import { isMatchEventType } from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";

type AdminAttendancePageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminAttendancePage({ params }: AdminAttendancePageProps) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/eventi/${id}/presenze`);
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
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

  if (!event) {
    redirect("/unauthorized");
  }

  const matchMode = isMatchEventType(event.type);

  const athletes = event.category
    ? event.category.athletes.map((athlete) => ({
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        position: athlete.position,
        shirtNumber: athlete.shirtNumber,
        status: athlete.attendances[0]?.status ?? null,
        goals: athlete.matchStats[0]?.goals ?? 0,
        assists: athlete.matchStats[0]?.assists ?? 0,
        goalsConceded: athlete.matchStats[0]?.goalsConceded ?? null,
      }))
    : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <AreaHeader
          title="Match Center (Admin)"
          subtitle={
            matchMode
              ? "Presenze, gol, assist e risultato partita"
              : "Controllo e aggiornamento rapido appello"
          }
          userName={session.user.name ?? "Amministratore"}
        />

        <Link
          href="/admin"
          className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Torna alla dashboard admin
        </Link>

        {event.category ? (
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
        ) : (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Questo evento non e collegato a una categoria: non ci sono atleti da associare
            all&apos;appello.
          </section>
        )}
      </div>
    </main>
  );
}
