import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { AttendanceManager } from "@/components/attendance/attendance-manager";
import { getAuthSession } from "@/lib/auth";
import { canManageEventAttendance } from "@/lib/attendance";
import { formatEventType } from "@/lib/events";
import { prisma } from "@/lib/prisma";

type AdminAttendancePageProps = {
  params: Promise<{ id: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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
      category: {
        select: {
          name: true,
          athletes: {
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            select: {
              id: true,
              firstName: true,
              lastName: true,
              attendances: {
                where: { eventId: id },
                select: { status: true },
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

  const athletes = event.category
    ? event.category.athletes.map((athlete) => ({
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        status: athlete.attendances[0]?.status ?? "PRESENT",
      }))
    : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <AreaHeader
          title="Presenze evento (Admin)"
          subtitle="Controllo e aggiornamento rapido appello"
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
            eventTitle={`${event.title} (${formatEventType(event.type)})`}
            eventCategoryName={`Categoria: ${event.category.name}`}
            eventDateLabel={dateFormatter.format(new Date(event.startAt))}
            athletes={athletes}
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
