import { redirect, notFound } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MatchDetailView } from "@/components/matches/match-detail-view";
import { getAuthSession } from "@/lib/auth";
import { getParentMatchDetail } from "@/lib/match-queries";
import { assertNoSessionToolsLeak } from "@/lib/session-tools-privacy";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function GenitorePartitaDetailPage({ params }: PageProps) {
  const session = await getAuthSession();
  const { eventId } = await params;

  if (!session?.user) {
    redirect(`/login?callbackUrl=/genitore/partite/${eventId}`);
  }
  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const detail = await getParentMatchDetail(session.user.id, eventId);
  if (!detail) {
    notFound();
  }

  const parentView = {
    id: detail.id,
    title: detail.title,
    startAtIso: detail.startAt.toISOString(),
    location: detail.location,
    opponentName: detail.opponentName,
    isHome: detail.isHome,
    homeScore: detail.homeScore,
    awayScore: detail.awayScore,
    resultLabel: detail.resultLabel,
    categoryName: detail.categoryName,
    status: detail.status,
    clubName: detail.clubName,
    scorers: detail.scorers,
    cards: detail.cards,
    ratings: detail.ratings.map((row) => ({
      athleteId: row.athleteId,
      fullName: row.fullName,
      matchAverage: row.matchAverage,
      notes: null as string | null,
      possessionScore: null as number | null,
      outOfPossessionScore: null as number | null,
      attitudeScore: null as number | null,
      teamworkScore: null as number | null,
    })),
    convocations: detail.convocations,
    coachManageHref: null as string | null,
    backHref: "/genitore/partite",
    audience: "parent" as const,
  };

  // Anti-leak: payload genitore non deve contenere chiavi grezze rating/disciplina.
  assertNoSessionToolsLeak({
    scorers: parentView.scorers,
    cards: parentView.cards.map(({ athleteId, fullName, label, minute }) => ({
      athleteId,
      fullName,
      label,
      minute,
    })),
    ratings: parentView.ratings.map(({ athleteId, fullName, matchAverage }) => ({
      athleteId,
      fullName,
      matchAverage,
    })),
    convocations: parentView.convocations,
  });

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <AreaHeader
          title="Dettaglio partita"
          subtitle={detail.categoryName}
          userName={session.user.name ?? "Genitore"}
        />
        <MatchDetailView match={parentView} />
      </div>
    </main>
  );
}
