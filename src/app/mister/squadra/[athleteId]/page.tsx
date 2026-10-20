import Link from "next/link";
import { redirect } from "next/navigation";
import { AthleteDisciplineClient } from "@/components/mister/athlete-discipline-client";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory } from "@/lib/athlete-access";
import { isCompetitionKind } from "@/lib/competition-kind";
import { seasonLabelFromDate } from "@/lib/discipline";
import { loadAthleteDisciplineSummary } from "@/lib/discipline-queries";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ athleteId: string }>;
  searchParams?: Promise<{ competitionKind?: string }>;
};

export default async function MisterAthleteDisciplinePage({
  params,
  searchParams,
}: PageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister/squadra");
  }
  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const { athleteId } = await params;
  const query = searchParams ? await searchParams : {};
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      categoryId: true,
      category: { select: { name: true, seasonLabel: true } },
    },
  });
  if (!athlete) {
    redirect("/mister/squadra");
  }

  const allowed = await canManageAthleteCategory({
    userId: session.user.id,
    role: session.user.role,
    categoryId: athlete.categoryId,
  });
  if (!allowed) {
    redirect("/unauthorized");
  }

  const competitionKind = isCompetitionKind(query.competitionKind)
    ? query.competitionKind
    : "LEAGUE";
  const seasonLabel = athlete.category.seasonLabel || seasonLabelFromDate();

  let summary: Awaited<ReturnType<typeof loadAthleteDisciplineSummary>> | null = null;
  let schemaMissing = false;
  try {
    summary = await loadAthleteDisciplineSummary({
      athleteId,
      seasonLabel,
      competitionKind,
    });
  } catch {
    schemaMissing = true;
  }

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <Link
          href="/mister/squadra"
          className="inline-flex w-fit rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800"
        >
          ← Torna alla squadra
        </Link>

        {schemaMissing || !summary ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Modulo disciplinare non ancora disponibile su questo database. Applica la migration{" "}
            <code>20261020120000_mister_discipline_ratings</code> in un ambiente controllato.
          </section>
        ) : (
          <AthleteDisciplineClient
            athleteId={athlete.id}
            athleteName={`${athlete.firstName} ${athlete.lastName}`.trim()}
            seasonLabel={seasonLabel}
            competitionKind={competitionKind}
            opening={
              summary.opening
                ? {
                    priorYellowCards: summary.opening.priorYellowCards,
                    priorYellowCardsForAccumulation:
                      summary.opening.priorYellowCardsForAccumulation,
                    priorRedCards: summary.opening.priorRedCards,
                    openSuspensionMatchdays: summary.opening.openSuspensionMatchdays,
                    referenceDate: summary.opening.referenceDate.toISOString(),
                    notes: summary.opening.notes,
                  }
                : null
            }
            incidents={summary.incidents.map((row) => ({
              id: row.id,
              type: row.type,
              status: row.status,
              notes: row.notes,
              event: row.event
                ? {
                    title: row.event.title,
                    startAt: row.event.startAt.toISOString(),
                  }
                : null,
              createdAt: row.createdAt.toISOString(),
            }))}
            suspensions={summary.suspensions.map((row) => ({
              id: row.id,
              matchdaysTotal: row.matchdaysTotal,
              officialRef: row.officialRef,
              status: row.status,
              servings: row.servings.map((serving) => ({
                id: serving.id,
                status: serving.status,
                event: serving.event ? { title: serving.event.title } : null,
              })),
            }))}
            totals={summary.totals}
          />
        )}

        <p className="text-xs text-zinc-500">Categoria: {athlete.category.name}</p>
      </div>
    </main>
  );
}
