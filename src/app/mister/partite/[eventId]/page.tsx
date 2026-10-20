import { redirect, notFound } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MatchDetailView } from "@/components/matches/match-detail-view";
import { getAuthSession } from "@/lib/auth";
import { getCoachMatchDetail } from "@/lib/match-queries";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function MisterPartitaDetailPage({ params }: PageProps) {
  const session = await getAuthSession();
  const { eventId } = await params;

  if (!session?.user) {
    redirect(`/login?callbackUrl=/mister/partite/${eventId}`);
  }
  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const detail = await getCoachMatchDetail(session.user.id, eventId);
  if (!detail) {
    notFound();
  }

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <AreaHeader
          title="Dettaglio partita"
          subtitle={detail.categoryName}
          userName={session.user.name ?? "Mister"}
        />
        <MatchDetailView
          match={{
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
            ratings: detail.ratings,
            convocations: detail.convocations,
            coachManageHref: detail.coachManageHref,
            backHref: "/mister/partite",
            audience: "coach",
          }}
        />
      </div>
    </main>
  );
}
