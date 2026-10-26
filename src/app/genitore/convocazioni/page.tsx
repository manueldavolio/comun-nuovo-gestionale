import { redirect } from "next/navigation";
import { ParentConvocations } from "@/components/convocations/parent-convocations";
import { ParentAreaHeader } from "@/components/parent-dashboard/parent-area-header";
import { getAuthSession } from "@/lib/auth";
import {
  CONVOCATIONS_SCHEMA_MISSING_MESSAGE,
  isMissingConvocationsSchemaError,
} from "@/lib/convocations-db";
import {
  formatConvocationWallClockDateTime,
  resolveMeetingAt,
} from "@/lib/convocation-times";
import {
  athletesAssociatedToParentWhere,
  getParentProfileIdForUser,
} from "@/lib/parent-athletes";
import { prisma } from "@/lib/prisma";

export default async function ParentConvocationsPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore/convocazioni");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const parentProfileId = await getParentProfileIdForUser(session.user.id);
  if (!parentProfileId) {
    redirect("/unauthorized");
  }

  let convocationEntries: Array<{
    id: string;
    responseStatus: "PENDING" | "PRESENT" | "ABSENT";
    athlete: { firstName: string; lastName: string };
    convocation: {
      notes: string | null;
      meetingAt: Date | null;
      category: { name: string };
      event: { title: string; startAt: Date; location: string | null } | null;
    };
  }> = [];
  let isConvocationsSchemaMissing = false;

  try {
    convocationEntries = await prisma.convocationAthlete.findMany({
      where: {
        athlete: athletesAssociatedToParentWhere(parentProfileId),
        convocation: {
          event: {
            isNot: null,
          },
        },
      },
      orderBy: {
        convocation: {
          event: {
            startAt: "asc",
          },
        },
      },
      take: 150,
      select: {
        id: true,
        responseStatus: true,
        athlete: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        convocation: {
          select: {
            notes: true,
            meetingAt: true,
            category: {
              select: {
                name: true,
              },
            },
            event: {
              select: {
                title: true,
                startAt: true,
                location: true,
              },
            },
          },
        },
      },
    });
  } catch (error) {
    if (isMissingConvocationsSchemaError(error)) {
      isConvocationsSchemaMissing = true;
    } else {
      throw error;
    }
  }

  const parentConvocations = convocationEntries
    .filter((entry) => Boolean(entry.convocation.event))
    .map((entry) => {
      const matchStartAt = entry.convocation.event!.startAt;
      const meetingAt = resolveMeetingAt(entry.convocation.meetingAt, matchStartAt);
      return {
        convocationAthleteId: entry.id,
        athleteFullName: `${entry.athlete.firstName} ${entry.athlete.lastName}`.trim(),
        categoryName: entry.convocation.category.name,
        eventTitle: entry.convocation.event!.title,
        meetingAtLabel: formatConvocationWallClockDateTime(meetingAt),
        matchStartAtLabel: formatConvocationWallClockDateTime(matchStartAt),
        eventLocation: entry.convocation.event!.location,
        notes: entry.convocation.notes,
        responseStatus: entry.responseStatus,
      };
    });

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100 via-slate-50 to-blue-100/60 p-4 pb-10 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <ParentAreaHeader
          title="Convocazioni"
          subtitle="Conferma presenza o indisponibilità"
          userName={session.user.name ?? "Genitore"}
          backHref="/genitore"
        />

        <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-zinc-900">Convocazioni ricevute</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Conferma se tuo figlio sarà presente all&apos;evento. Le risposte aggiornano subito lo
            stato della convocazione.
          </p>
          {isConvocationsSchemaMissing ? (
            <p className="mt-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-950">
              {CONVOCATIONS_SCHEMA_MISSING_MESSAGE}
            </p>
          ) : (
            <ParentConvocations items={parentConvocations} />
          )}
        </section>
      </div>
    </main>
  );
}
