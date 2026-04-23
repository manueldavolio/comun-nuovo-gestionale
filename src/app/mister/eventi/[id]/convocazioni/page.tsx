import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { ConvocationManager } from "@/components/convocations/convocation-manager";
import { getAuthSession } from "@/lib/auth";
import { canManageEventAttendance } from "@/lib/attendance";
import { formatEventType } from "@/lib/events";
import { prisma } from "@/lib/prisma";

type MisterConvocationPageProps = {
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

export default async function MisterConvocationPage({ params }: MisterConvocationPageProps) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/mister/eventi/${id}/convocazioni`);
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
      category: {
        select: {
          name: true,
          athletes: {
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      convocation: {
        select: {
          notes: true,
          athletes: {
            select: {
              athleteId: true,
              responseStatus: true,
            },
          },
        },
      },
    },
  });

  if (!event || !event.category) {
    redirect("/unauthorized");
  }

  const selectedByAthleteId = new Set(event.convocation?.athletes.map((entry) => entry.athleteId) ?? []);
  const responseByAthleteId = new Map(
    event.convocation?.athletes.map((entry) => [entry.athleteId, entry.responseStatus]) ?? [],
  );
  const athletes = event.category.athletes.map((athlete) => ({
    id: athlete.id,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    isSelected: selectedByAthleteId.has(athlete.id),
    responseStatus: responseByAthleteId.get(athlete.id) ?? "PENDING",
  }));

  const backHref =
    session.user.role === "ADMIN" || session.user.role === "YOUTH_DIRECTOR" ? "/admin" : "/mister";

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <AreaHeader
          title="Gestione convocazioni"
          subtitle="Seleziona convocati e controlla conferme"
          userName={session.user.name ?? "Staff"}
        />

        <Link
          href={backHref}
          className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Torna alla dashboard
        </Link>

        <ConvocationManager
          eventId={event.id}
          eventTitle={`${event.title} (${formatEventType(event.type)})`}
          eventCategoryName={`Categoria: ${event.category.name}`}
          eventDateLabel={dateFormatter.format(new Date(event.startAt))}
          initialNotes={event.convocation?.notes ?? ""}
          athletes={athletes}
        />
      </div>
    </main>
  );
}
