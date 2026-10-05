import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { PredictionSlipForm } from "@/components/admin/prediction-slip-form";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveMatchDayOpponentName } from "@/lib/match-day";
import {
  buildMatchSideLabels,
  computeEffectiveClosesAt,
  evaluatePredictionEntry,
  formatPredictionChoiceLabel,
  resolveOfficialPredictionOutcome,
  resolveSlipLockState,
} from "@/lib/prediction-slip";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

type PageProps = { params: Promise<{ slipId: string }> };

export default async function AdminSchedinaDetailPage({ params }: PageProps) {
  const { slipId } = await params;
  const session = await getAuthSession();
  if (!session?.user) redirect(`/login?callbackUrl=/admin/schedina/${slipId}`);
  if (session.user.role !== "ADMIN") redirect("/unauthorized");

  const slip = await prisma.predictionSlip.findUnique({
    where: { id: slipId },
    include: {
      events: {
        orderBy: { sortOrder: "asc" },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startAt: true,
              isHome: true,
              opponentName: true,
              homeScore: true,
              awayScore: true,
              category: { select: { name: true } },
            },
          },
        },
      },
      entries: {
        orderBy: { submittedAt: "asc" },
        include: {
          parent: { select: { firstName: true, lastName: true } },
          picks: true,
        },
      },
    },
  });

  if (!slip) redirect("/admin/schedina");

  const now = nowAsEuropeRomeWallClockUtc();
  const eventStartAts = slip.events.map((row) => row.event.startAt);
  const effective =
    slip.effectiveClosesAt ?? computeEffectiveClosesAt(slip.closesAt, eventStartAts);
  const lock =
    slip.isPublished && slip.effectiveClosesAt
      ? resolveSlipLockState({
          lockedAt: slip.lockedAt,
          effectiveClosesAt: slip.effectiveClosesAt,
          now,
        })
      : { state: "OPEN" as const, effectiveClosesAt: effective, shouldPersistLockedAt: false };

  const concluded = slip.events.filter(
    (row) => resolveOfficialPredictionOutcome(row.event.homeScore, row.event.awayScore) !== "PENDING",
  ).length;

  const entryRows = slip.entries.map((entry) => {
    const evaluation = evaluatePredictionEntry({
      slipEventCount: slip.events.length,
      picks: entry.picks.map((pick) => {
        const slipEvent = slip.events.find((row) => row.id === pick.slipEventId);
        return {
          choice: pick.choice,
          homeScore: slipEvent?.event.homeScore,
          awayScore: slipEvent?.event.awayScore,
        };
      }),
    });
    return { entry, evaluation };
  });

  const perfect = entryRows.filter((row) => row.evaluation.perfect);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title={slip.title}
          subtitle={`Premio: ${slip.prizeText}`}
          userName={session.user.name ?? "Amministratore"}
        />
        <Link href="/admin/schedina" className="w-fit text-sm font-semibold text-blue-800">
          ← Torna all&apos;elenco
        </Link>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-700">
            Stato: {slip.isPublished ? "Pubblicata" : "Bozza"} ·{" "}
            {lock.state === "LOCKED" ? "Chiusa" : "Aperta"} · {slip.entries.length} partecipanti ·{" "}
            {concluded}/{slip.events.length} partite concluse
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Chiusura effettiva: {dateTimeFormatter.format(lock.effectiveClosesAt)}
            {slip.lockedAt
              ? ` · lockedAt: ${dateTimeFormatter.format(slip.lockedAt)}`
              : ""}
          </p>
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Partite</h2>
          <ul className="mt-3 space-y-2">
            {slip.events.map((row) => {
              const opponent = resolveMatchDayOpponentName({
                opponentName: row.event.opponentName,
                title: row.event.title,
              });
              const sides = buildMatchSideLabels({
                isHome: row.event.isHome === true,
                opponentName: opponent,
              });
              const outcome = resolveOfficialPredictionOutcome(
                row.event.homeScore,
                row.event.awayScore,
              );
              return (
                <li key={row.id} className="rounded-lg border border-blue-50 bg-sky-50/50 px-3 py-2 text-sm">
                  <p className="font-semibold text-zinc-900">
                    {row.sortOrder}. {row.event.category?.name ?? "Partita"} · {sides.homeLabel} vs{" "}
                    {sides.awayLabel}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {dateTimeFormatter.format(row.event.startAt)} · Esito:{" "}
                    {outcome === "PENDING" ? "In attesa" : formatPredictionChoiceLabel(outcome)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Partecipanti</h2>
          {entryRows.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nessuna giocata ancora.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {entryRows.map(({ entry, evaluation }) => (
                <li key={entry.id} className="rounded-lg border border-zinc-100 px-3 py-2 text-sm">
                  <p className="font-semibold text-zinc-900">
                    {entry.parent.firstName} {entry.parent.lastName}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {evaluation.correct}/{evaluation.total} corretti
                    {evaluation.pending > 0 ? ` · ${evaluation.pending} in attesa` : ""}
                    {evaluation.perfect ? " · PERFETTA" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {concluded === slip.events.length && slip.events.length > 0 ? (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-emerald-900">
              SCHEDINE PERFETTE: {perfect.length}
            </h2>
            {perfect.length > 1 ? (
              <p className="mt-1 text-sm text-emerald-800">
                Effettuare estrazione tra i vincitori.
              </p>
            ) : null}
            <ul className="mt-3 space-y-1">
              {perfect.map(({ entry }) => (
                <li key={entry.id} className="text-sm font-medium text-emerald-950">
                  {entry.parent.firstName} {entry.parent.lastName}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Modifica</h2>
          <PredictionSlipForm
            mode="edit"
            slipId={slip.id}
            initial={{
              title: slip.title,
              prizeText: slip.prizeText,
              closesAt: slip.closesAt.toISOString(),
              isPublished: slip.isPublished,
              eventIds: slip.events.map((row) => row.eventId),
              compositionImmutable: slip.entries.length > 0,
            }}
          />
        </section>
      </div>
    </main>
  );
}
