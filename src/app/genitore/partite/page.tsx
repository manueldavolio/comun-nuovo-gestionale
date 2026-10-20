import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MatchListClient, type MatchListItem } from "@/components/matches/match-list-client";
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
    <main className="p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <AreaHeader
          title="Partite"
          subtitle="Gare delle squadre dei tuoi figli"
          userName={session.user.name ?? "Genitore"}
        />
        <Link
          href="/genitore"
          className="inline-flex w-fit rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          ← Dashboard
        </Link>
        <MatchListClient
          items={items}
          wallNowIso={wallNow.toISOString()}
          emptyLabel="Nessuna partita in stagione per le squadre dei tuoi figli."
        />
      </div>
    </main>
  );
}
