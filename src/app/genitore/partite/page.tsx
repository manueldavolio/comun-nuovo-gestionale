import { redirect } from "next/navigation";
import { MatchListClient, type MatchListItem } from "@/components/matches/match-list-client";
import { ParentAreaHeader } from "@/components/parent-dashboard/parent-area-header";
import { getAuthSession } from "@/lib/auth";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { listMatchesForParent } from "@/lib/match-queries";

export default async function GenitorePartitePage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore/partite");
  }
  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const wallNow = nowAsEuropeRomeWallClockUtc();
  const rows = await listMatchesForParent(session.user.id);
  const items: MatchListItem[] = rows.map((row) => ({
    id: row.id,
    startAt: row.startAt.toISOString(),
    title: row.title,
    opponentName: row.opponentName,
    location: row.location,
    isHome: row.isHome,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    categoryName: row.categoryName,
    status: row.status,
    href: `/genitore/partite/${row.id}`,
  }));

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100 via-slate-50 to-blue-100/60 p-4 pb-10 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <ParentAreaHeader
          title="Partite"
          subtitle="Gare delle squadre dei tuoi figli"
          userName={session.user.name ?? "Genitore"}
          backHref="/genitore"
        />
        <MatchListClient
          items={items}
          wallNowIso={wallNow.toISOString()}
          emptyLabel="Nessuna partita in stagione per le squadre dei tuoi figli."
        />
      </div>
    </main>
  );
}
