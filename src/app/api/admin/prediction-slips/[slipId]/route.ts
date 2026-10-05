import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  advanceEffectiveClosesAtOnlyEarlier,
  buildMatchSideLabels,
  computeEffectiveClosesAt,
  evaluatePredictionEntry,
  formatPredictionChoiceLabel,
  isEventEligibleForPredictionSlip,
  resolveOfficialPredictionOutcome,
} from "@/lib/prediction-slip";
import { resolveAndPersistSlipLock } from "@/lib/prediction-slip-server";
import { resolveMatchDayOpponentName } from "@/lib/match-day";

async function requireAdmin() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Sessione non valida." }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Operazione non consentita." }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slipId: string }> },
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { slipId } = await context.params;
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
              type: true,
              startAt: true,
              isHome: true,
              opponentName: true,
              homeScore: true,
              awayScore: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
      entries: {
        orderBy: { submittedAt: "asc" },
        include: {
          parent: {
            select: { id: true, firstName: true, lastName: true },
          },
          picks: {
            select: {
              id: true,
              slipEventId: true,
              choice: true,
            },
          },
        },
      },
      _count: { select: { entries: true, events: true } },
    },
  });

  if (!slip) {
    return NextResponse.json({ error: "Schedina non trovata." }, { status: 404 });
  }

  const previewEffective =
    slip.effectiveClosesAt ??
    computeEffectiveClosesAt(
      slip.closesAt,
      slip.events.map((row) => row.event.startAt),
    );

  const lock = slip.isPublished && slip.effectiveClosesAt
    ? await resolveAndPersistSlipLock({
        prisma,
        slip: {
          id: slip.id,
          effectiveClosesAt: slip.effectiveClosesAt,
          lockedAt: slip.lockedAt,
        },
      })
    : {
        state: "OPEN" as const,
        effectiveClosesAt: previewEffective,
        lockedAt: slip.lockedAt,
      };

  const concluded = slip.events.filter(
    (row) =>
      resolveOfficialPredictionOutcome(row.event.homeScore, row.event.awayScore) !== "PENDING",
  ).length;

  const entries = slip.entries.map((entry) => {
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

    return {
      id: entry.id,
      parentId: entry.parentId,
      firstName: entry.parent.firstName,
      lastName: entry.parent.lastName,
      submittedAt: entry.submittedAt,
      updatedAt: entry.updatedAt,
      evaluation,
      picks: entry.picks.map((pick) => ({
        slipEventId: pick.slipEventId,
        choice: pick.choice,
        choiceLabel: formatPredictionChoiceLabel(pick.choice),
      })),
    };
  });

  const perfectEntries = entries.filter((entry) => entry.evaluation.perfect);

  const events = slip.events.map((row) => {
    const opponent = resolveMatchDayOpponentName({
      opponentName: row.event.opponentName,
      title: row.event.title,
    });
    const sides = buildMatchSideLabels({
      isHome: row.event.isHome === true,
      opponentName: opponent,
    });
    const outcome = resolveOfficialPredictionOutcome(row.event.homeScore, row.event.awayScore);
    return {
      id: row.id,
      sortOrder: row.sortOrder,
      eventId: row.event.id,
      title: row.event.title,
      type: row.event.type,
      startAt: row.event.startAt,
      categoryName: row.event.category?.name ?? null,
      isHome: row.event.isHome,
      opponentName: opponent,
      homeLabel: sides.homeLabel,
      awayLabel: sides.awayLabel,
      homeScore: row.event.homeScore,
      awayScore: row.event.awayScore,
      outcome,
      outcomeLabel: formatPredictionChoiceLabel(outcome),
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      id: slip.id,
      title: slip.title,
      prizeText: slip.prizeText,
      closesAt: slip.closesAt,
      lockedAt: lock.lockedAt,
      isPublished: slip.isPublished,
      lockState: lock.state,
      effectiveClosesAt: lock.effectiveClosesAt,
      participantsCount: slip._count.entries,
      eventsCount: slip._count.events,
      concludedEvents: concluded,
      events,
      entries,
      perfectEntries: perfectEntries.map((entry) => ({
        entryId: entry.id,
        firstName: entry.firstName,
        lastName: entry.lastName,
      })),
      compositionImmutable: slip._count.entries > 0,
    },
  });
}

type PatchPayload = {
  title?: unknown;
  prizeText?: unknown;
  closesAt?: unknown;
  eventIds?: unknown;
  isPublished?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slipId: string }> },
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { slipId } = await context.params;

  let payload: PatchPayload;
  try {
    payload = (await request.json()) as PatchPayload;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const existing = await prisma.predictionSlip.findUnique({
    where: { id: slipId },
    include: {
      events: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, eventId: true, sortOrder: true, event: { select: { startAt: true } } },
      },
      _count: { select: { entries: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Schedina non trovata." }, { status: 404 });
  }

  const hasEntries = existing._count.entries > 0;
  const wasPublished = existing.isPublished;
  const title =
    typeof payload.title === "string" ? payload.title.trim() : existing.title;
  const prizeText =
    typeof payload.prizeText === "string" ? payload.prizeText.trim() : existing.prizeText;
  const isPublished =
    typeof payload.isPublished === "boolean" ? payload.isPublished : existing.isPublished;

  if (!title || !prizeText) {
    return NextResponse.json({ error: "Titolo e premio sono obbligatori." }, { status: 400 });
  }

  let closesAt = existing.closesAt;
  if (typeof payload.closesAt === "string" && payload.closesAt.trim()) {
    const nextClosesAt = new Date(payload.closesAt.trim());
    if (Number.isNaN(nextClosesAt.getTime())) {
      return NextResponse.json({ error: "Data/ora di chiusura non valida." }, { status: 400 });
    }
    if (wasPublished && nextClosesAt.getTime() > existing.closesAt.getTime()) {
      return NextResponse.json(
        { error: "Dopo la pubblicazione la chiusura può solo essere anticipata." },
        { status: 409 },
      );
    }
    if (hasEntries && nextClosesAt.getTime() > existing.closesAt.getTime()) {
      return NextResponse.json(
        { error: "Con giocate esistenti la chiusura può solo essere anticipata." },
        { status: 409 },
      );
    }
    closesAt = nextClosesAt;
  }

  const wantsEventUpdate = Array.isArray(payload.eventIds);
  let nextEventIds = existing.events.map((row) => row.eventId);

  if (wantsEventUpdate) {
    if (hasEntries || wasPublished) {
      return NextResponse.json(
        {
          error: wasPublished
            ? "Dopo la pubblicazione la composizione della schedina è immutabile."
            : "La composizione della schedina è immutabile: esistono già giocate dei genitori.",
        },
        { status: 409 },
      );
    }

    nextEventIds = (payload.eventIds as unknown[])
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim());

    const unique = [...new Set(nextEventIds)];
    if (unique.length !== nextEventIds.length) {
      return NextResponse.json({ error: "Partite duplicate nella schedina." }, { status: 400 });
    }
    nextEventIds = unique;
  }

  if (isPublished && nextEventIds.length === 0) {
    return NextResponse.json({ error: "Per pubblicare serve almeno una partita." }, { status: 400 });
  }

  let eventsForStart: Array<{ id: string; startAt: Date; type: string; title: string; isHome: boolean | null; opponentName: string | null }> = [];
  if (nextEventIds.length > 0) {
    eventsForStart = await prisma.event.findMany({
      where: { id: { in: nextEventIds } },
      select: {
        id: true,
        type: true,
        title: true,
        startAt: true,
        isHome: true,
        opponentName: true,
      },
    });
    if (eventsForStart.length !== nextEventIds.length) {
      return NextResponse.json({ error: "Uno o più eventi non esistono." }, { status: 400 });
    }
    const byId = new Map(eventsForStart.map((event) => [event.id, event]));
    for (const eventId of nextEventIds) {
      const eligible = isEventEligibleForPredictionSlip(byId.get(eventId)!);
      if (!eligible.ok) {
        return NextResponse.json({ error: eligible.reason }, { status: 400 });
      }
    }
  }

  const orderedStartAts = nextEventIds.map(
    (id) => eventsForStart.find((event) => event.id === id)!.startAt,
  );

  let effectiveClosesAt = existing.effectiveClosesAt;
  if (isPublished && !wasPublished) {
    effectiveClosesAt = computeEffectiveClosesAt(closesAt, orderedStartAts);
  } else if (isPublished && wasPublished && existing.effectiveClosesAt) {
    effectiveClosesAt = advanceEffectiveClosesAtOnlyEarlier(
      existing.effectiveClosesAt,
      closesAt,
    );
  } else if (!isPublished) {
    effectiveClosesAt = null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.predictionSlip.update({
      where: { id: slipId },
      data: {
        title,
        prizeText,
        closesAt,
        effectiveClosesAt,
        isPublished,
      },
    });

    if (wantsEventUpdate && !hasEntries && !wasPublished) {
      await tx.predictionSlipEvent.deleteMany({ where: { slipId } });
      if (nextEventIds.length > 0) {
        await tx.predictionSlipEvent.createMany({
          data: nextEventIds.map((eventId, index) => ({
            slipId,
            eventId,
            sortOrder: index + 1,
          })),
        });
      }
    }
  });

  return NextResponse.json({ success: true });
}
