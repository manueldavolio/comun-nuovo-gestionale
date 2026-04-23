import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { ParentConvocations } from "@/components/convocations/parent-convocations";
import { getAuthSession } from "@/lib/auth";
import {
  CONVOCATIONS_SCHEMA_MISSING_MESSAGE,
  isMissingConvocationsSchemaError,
} from "@/lib/convocations-db";
import { prisma } from "@/lib/prisma";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ParentConvocationsPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore/convocazioni");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  let convocationEntries: Array<{
    id: string;
    responseStatus: "PENDING" | "PRESENT" | "ABSENT";
    athlete: { firstName: string; lastName: string };
    convocation: {
      notes: string | null;
      category: { name: string };
      event: { title: string; startAt: Date; location: string | null } | null;
    };
  }> = [];
  let isConvocationsSchemaMissing = false;

  try {
    convocationEntries = await prisma.convocationAthlete.findMany({
      where: {
        athlete: {
          parent: {
            userId: session.user.id,
          },
        },
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
    .map((entry) => ({
      convocationAthleteId: entry.id,
      athleteFullName: `${entry.athlete.firstName} ${entry.athlete.lastName}`.trim(),
      categoryName: entry.convocation.category.name,
      eventTitle: entry.convocation.event!.title,
      eventStartAtLabel: dateTimeFormatter.format(new Date(entry.convocation.event!.startAt)),
      eventLocation: entry.convocation.event!.location,
      notes: entry.convocation.notes,
      responseStatus: entry.responseStatus,
    }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Convocazioni"
          subtitle="Conferma presenza o assenza dei tuoi figli"
          userName={session.user.name ?? "Genitore"}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/genitore"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna dashboard genitore
          </Link>
        </div>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Convocazioni ricevute</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Le risposte vengono salvate solo nel gestionale e aggiornano subito lo stato convocazione.
          </p>
          {isConvocationsSchemaMissing ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
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
