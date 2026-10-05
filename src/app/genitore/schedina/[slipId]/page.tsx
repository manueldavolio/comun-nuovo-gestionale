import Link from "next/link";
import { redirect } from "next/navigation";
import { PredictionSlipPlayer } from "@/components/parent-dashboard/prediction-slip-player";
import { getAuthSession } from "@/lib/auth";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { resolveMatchDayOpponentName } from "@/lib/match-day";
import { prisma } from "@/lib/prisma";
import {
  buildMatchSideLabels,
  evaluatePredictionEntry,
  evaluatePredictionPick,
  formatPredictionChoiceLabel,
  resolveOfficialPredictionOutcome,
} from "@/lib/prediction-slip";
import { resolveAndPersistSlipLock } from "@/lib/prediction-slip-server";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

type PageProps = { params: Promise<{ slipId: string }> };

export default async function ParentSchedinaPage({ params }: PageProps) {
  const { slipId } = await params;
  const session = await getAuthSession();
  if (!session?.user) redirect(`/login?callbackUrl=/genitore/schedina/${slipId}`);
  if (session.user.role !== "PARENT") redirect("/unauthorized");

  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!parent) redirect("/unauthorized");

  const slip = await prisma.predictionSlip.findUnique({
    where: { id: slipId },
    include: {
      events: {
        orderBy: { sortOrder: "asc" },
        include: {
          event: {
            select: {
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
        where: { parentId: parent.id },
        take: 1,
        include: { picks: true },
      },
    },
  });

  if (!slip || !slip.isPublished || !slip.effectiveClosesAt) {
    redirect("/genitore");
  }

  const lock = await resolveAndPersistSlipLock({
    prisma,
    slip: {
      id: slip.id,
      effectiveClosesAt: slip.effectiveClosesAt,
      lockedAt: slip.lockedAt,
    },
    now: nowAsEuropeRomeWallClockUtc(),
  });

  const ownEntry = slip.entries[0] ?? null;
  const pickByEvent = new Map(ownEntry?.picks.map((pick) => [pick.slipEventId, pick.choice]) ?? []);

  const events = slip.events.map((row) => {
    const opponent = resolveMatchDayOpponentName({
      opponentName: row.event.opponentName,
      title: row.event.title,
    });
    const sides = buildMatchSideLabels({
      isHome: row.event.isHome === true,
      opponentName: opponent,
    });
    const choice = pickByEvent.get(row.id) ?? null;
    const outcome = resolveOfficialPredictionOutcome(row.event.homeScore, row.event.awayScore);
    return {
      slipEventId: row.id,
      categoryName: row.event.category?.name ?? "Partita",
      homeLabel: sides.homeLabel,
      awayLabel: sides.awayLabel,
      choice,
      choiceLabel: choice ? formatPredictionChoiceLabel(choice) : null,
      outcome,
      outcomeLabel: formatPredictionChoiceLabel(outcome),
      pickEvaluation: choice
        ? evaluatePredictionPick({
            choice,
            homeScore: row.event.homeScore,
            awayScore: row.event.awayScore,
          })
        : null,
    };
  });

  const evaluation = ownEntry
    ? evaluatePredictionEntry({
        slipEventCount: slip.events.length,
        picks: ownEntry.picks.map((pick) => {
          const slipEvent = slip.events.find((row) => row.id === pick.slipEventId);
          return {
            choice: pick.choice,
            homeScore: slipEvent?.event.homeScore,
            awayScore: slipEvent?.event.awayScore,
          };
        }),
      })
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 via-sky-50 to-blue-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-xl">
        <Link
          href="/genitore"
          className="mb-3 inline-flex text-sm font-semibold text-blue-800"
        >
          ← Torna alla dashboard
        </Link>
        <PredictionSlipPlayer
          slipId={slip.id}
          title={slip.title}
          prizeText={slip.prizeText}
          lockState={lock.state}
          effectiveClosesAtLabel={dateTimeFormatter.format(lock.effectiveClosesAt)}
          initialEvents={events}
          hasEntry={Boolean(ownEntry)}
          evaluation={evaluation}
        />
      </div>
    </main>
  );
}
