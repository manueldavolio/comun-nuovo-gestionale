import Link from "next/link";
import { redirect } from "next/navigation";
import { ParentAreaHeader } from "@/components/parent-dashboard/parent-area-header";
import { getAuthSession } from "@/lib/auth";
import { formatConvocationWallClockDate, formatConvocationWallClockTime } from "@/lib/convocation-times";
import { athletesAssociatedToParentWhere } from "@/lib/parent-athletes";
import { MATCH_EVENT_TYPES } from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";
import {
  isBaseActivityCategory,
  parseManualStandingsJson,
  showsCompetitiveStandings,
  sourceTypeLabel,
} from "@/lib/team-competition";

type Props = { searchParams: Promise<{ athleteId?: string }> };

export default async function ParentSquadraPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session?.user?.id || session.user.role !== "PARENT") {
    redirect("/login?callbackUrl=/genitore/squadra");
  }

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!parentProfile) redirect("/genitore");

  const params = await searchParams;
  const athletes = await prisma.athlete.findMany({
    where: athletesAssociatedToParentWhere(parentProfile.id),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      category: {
        select: {
          id: true,
          name: true,
          sector: true,
          seasonLabel: true,
          competitionSource: true,
        },
      },
    },
    orderBy: { firstName: "asc" },
  });
  const selected =
    athletes.find((a) => a.id === (params.athleteId ?? "").trim()) ?? athletes[0] ?? null;
  if (!selected) {
    return (
      <main className="p-6">
        <p>Nessun atleta collegato.</p>
        <Link href="/genitore">Torna indietro</Link>
      </main>
    );
  }

  const categoryId = selected.category.id;
  const now = new Date();
  const competitive = showsCompetitiveStandings(
    selected.category.name,
    selected.category.sector,
  );
  const baseActivity = isBaseActivityCategory(selected.category.name);
  const source = selected.category.competitionSource;

  const [nextMatch, recentResults, seasonEvents, announcements] = await Promise.all([
    prisma.event.findFirst({
      where: {
        categoryId,
        type: { in: [...MATCH_EVENT_TYPES] },
        startAt: { gte: now },
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        startAt: true,
        opponentName: true,
        isHome: true,
        location: true,
      },
    }),
    prisma.event.findMany({
      where: {
        categoryId,
        type: { in: [...MATCH_EVENT_TYPES] },
        startAt: { lt: now },
        OR: [{ homeScore: { not: null } }, { awayScore: { not: null } }],
      },
      orderBy: { startAt: "desc" },
      take: 5,
      select: {
        id: true,
        startAt: true,
        opponentName: true,
        isHome: true,
        homeScore: true,
        awayScore: true,
        title: true,
      },
    }),
    prisma.event.findMany({
      where: {
        categoryId,
        seasonLabel: selected.category.seasonLabel,
      },
      orderBy: { startAt: "asc" },
      take: 40,
      select: {
        id: true,
        type: true,
        title: true,
        startAt: true,
        opponentName: true,
        location: true,
      },
    }),
    baseActivity
      ? prisma.announcement.findMany({
          where: {
            publishedAt: { not: null, lte: now },
            OR: [
              { audience: "ALL" },
              { audience: "PARENTS" },
              { audience: "CATEGORY_ONLY", categoryId },
            ],
          },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          take: 5,
          select: { id: true, title: true, createdAt: true, publishedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const manualStandings =
    source?.manualStandingsJson != null
      ? parseManualStandingsJson(source.manualStandingsJson)
      : null;

  const back = `/genitore?athleteId=${selected.id}`;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100 via-slate-50 to-blue-100/60 p-4 pb-10 md:p-8">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <ParentAreaHeader
          title="La mia squadra"
          subtitle={`${selected.firstName} ${selected.lastName} · ${selected.category.name}`}
          userName={session.user.name ?? "Genitore"}
          backHref={back}
        />

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
            Prossima partita
          </p>
          {nextMatch ? (
            <div className="mt-2">
              <p className="text-lg font-black text-blue-950">
                {nextMatch.isHome === false ? "@ " : "vs "}
                {nextMatch.opponentName ?? nextMatch.title}
              </p>
              <p className="text-sm text-zinc-600">
                {formatConvocationWallClockDate(nextMatch.startAt)} ·{" "}
                {formatConvocationWallClockTime(nextMatch.startAt)}
                {nextMatch.location ? ` · ${nextMatch.location}` : ""}
              </p>
              <Link
                href={`/genitore/partite/${nextMatch.id}`}
                className="mt-2 inline-flex text-xs font-bold text-blue-800 underline"
              >
                Dettaglio partita
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">Nessuna partita in programma nel gestionale.</p>
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
            Ultimi risultati
          </p>
          {recentResults.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nessun risultato registrato.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {recentResults.map((match) => (
                <li key={match.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-zinc-800">
                    {match.opponentName ?? match.title}
                  </span>
                  <span className="font-black tabular-nums text-blue-950">
                    {match.homeScore ?? "–"}-{match.awayScore ?? "–"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {source?.widgetResultsUrl ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-sky-100">
              <iframe
                title="Risultati esterni"
                src={source.widgetResultsUrl}
                className="h-[420px] w-full max-w-full"
                loading="lazy"
              />
            </div>
          ) : null}
        </section>

        {competitive ? (
          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
              Classifica del girone
            </p>
            {source ? (
              <p className="mt-1 text-xs text-zinc-500">
                {source.competitionName}
                {source.groupLabel ? ` · ${source.groupLabel}` : ""} ·{" "}
                {sourceTypeLabel(source.sourceType)}
                {source.lastVerifiedAt
                  ? ` · verificata ${source.lastVerifiedAt.toISOString().slice(0, 10)}`
                  : ""}
                {source.lastManualUpdateAt
                  ? ` · aggiornamento manuale ${source.lastManualUpdateAt.toISOString().slice(0, 10)}`
                  : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">
                Fonte classifica non ancora configurata dall&apos;amministrazione. I risultati del
                gestionale restano disponibili sopra.
              </p>
            )}
            {source?.widgetStandingsUrl ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-sky-100">
                <iframe
                  title="Classifica esterna"
                  src={source.widgetStandingsUrl}
                  className="h-[520px] w-full max-w-full"
                  loading="lazy"
                />
              </div>
            ) : null}
            {!source?.widgetStandingsUrl && manualStandings && manualStandings.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-blue-800">
                      <th className="py-1 pr-2">#</th>
                      <th className="py-1 pr-2">Squadra</th>
                      <th className="py-1">Pt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualStandings.map((row) => (
                      <tr key={`${row.pos}-${row.team}`} className="border-t border-sky-50">
                        <td className="py-1.5 pr-2 font-bold">{row.pos}</td>
                        <td className="py-1.5 pr-2">{row.team}</td>
                        <td className="py-1.5 font-black tabular-nums">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {source?.sourcePageUrl ? (
              <a
                href={source.sourcePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-xs font-bold text-blue-800 underline"
              >
                Apri fonte originale
              </a>
            ) : null}
          </section>
        ) : (
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-950 shadow-sm">
            Per l&apos;attività di base non mostriamo classifiche competitive. Qui trovi calendario,
            attività e comunicazioni della categoria.
          </section>
        )}

        {baseActivity && announcements.length > 0 ? (
          <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
              Comunicazioni
            </p>
            <ul className="mt-2 space-y-2 text-sm">
              {announcements.map((item) => (
                <li key={item.id} className="font-semibold text-zinc-800">
                  {item.title}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {(item.publishedAt ?? item.createdAt).toLocaleDateString("it-IT")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
              Calendario completo
            </p>
            <Link
              href={`/genitore/calendario?athleteId=${selected.id}`}
              className="text-xs font-bold text-blue-800"
            >
              Vista calendario
            </Link>
          </div>
          {seasonEvents.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nessun evento in stagione.</p>
          ) : (
            <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto text-sm">
              {seasonEvents.map((event) => (
                <li key={event.id} className="flex justify-between gap-2 border-b border-sky-50 py-1.5">
                  <span className="font-medium text-zinc-800">
                    {event.opponentName ?? event.title}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatConvocationWallClockDate(event.startAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {source?.widgetNextMatchUrl ? (
          <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white p-2 shadow-sm">
            <iframe
              title="Prossima partita esterna"
              src={source.widgetNextMatchUrl}
              className="h-[360px] w-full"
              loading="lazy"
            />
          </section>
        ) : null}

        <Link href={back} className="text-sm font-bold text-blue-800">
          ← Torna alla dashboard
        </Link>
      </div>
    </main>
  );
}
