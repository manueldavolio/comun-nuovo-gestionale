import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveMatchDayOpponentName } from "@/lib/match-day";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { resolveAndPersistSlipLock } from "@/lib/prediction-slip-server";
import {
  buildMatchSideLabels,
  evaluatePredictionEntry,
  evaluatePredictionPick,
  formatPredictionChoiceLabel,
  PredictionSlipClosedError,
  PredictionSlipNotFoundError,
  PredictionSlipValidationError,
  resolveOfficialPredictionOutcome,
  resolveSlipLockState,
  validateCompletePicksPayload,
} from "@/lib/prediction-slip";

async function requireParent() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Sessione non valida." }, { status: 401 }) };
  }
  if (session.user.role !== "PARENT") {
    return { error: NextResponse.json({ error: "Operazione non consentita." }, { status: 403 }) };
  }

  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!parent) {
    return { error: NextResponse.json({ error: "Profilo genitore non trovato." }, { status: 403 }) };
  }

  return { session, parentProfileId: parent.id };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slipId: string }> },
) {
  const auth = await requireParent();
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
              category: { select: { name: true } },
            },
          },
        },
      },
      entries: {
        where: { parentId: auth.parentProfileId },
        take: 1,
        include: {
          picks: true,
        },
      },
    },
  });

  if (!slip || !slip.isPublished || !slip.effectiveClosesAt) {
    return NextResponse.json({ error: "Schedina non trovata." }, { status: 404 });
  }

  const lock = await resolveAndPersistSlipLock({
    prisma,
    slip: {
      id: slip.id,
      effectiveClosesAt: slip.effectiveClosesAt,
      lockedAt: slip.lockedAt,
    },
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
    const outcome = resolveOfficialPredictionOutcome(row.event.homeScore, row.event.awayScore);
    const choice = pickByEvent.get(row.id) ?? null;
    const pickEval = choice
      ? evaluatePredictionPick({
          choice,
          homeScore: row.event.homeScore,
          awayScore: row.event.awayScore,
        })
      : null;

    return {
      slipEventId: row.id,
      sortOrder: row.sortOrder,
      categoryName: row.event.category?.name ?? "Partita",
      startAt: row.event.startAt,
      homeLabel: sides.homeLabel,
      awayLabel: sides.awayLabel,
      choice,
      choiceLabel: choice ? formatPredictionChoiceLabel(choice) : null,
      outcome,
      outcomeLabel: formatPredictionChoiceLabel(outcome),
      pickEvaluation: pickEval,
      homeScore: row.event.homeScore,
      awayScore: row.event.awayScore,
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

  return NextResponse.json({
    success: true,
    data: {
      id: slip.id,
      title: slip.title,
      prizeText: slip.prizeText,
      closesAt: slip.closesAt,
      effectiveClosesAt: lock.effectiveClosesAt,
      lockState: lock.state,
      eventsCount: slip.events.length,
      ownEntry: ownEntry
        ? {
            id: ownEntry.id,
            submittedAt: ownEntry.submittedAt,
            updatedAt: ownEntry.updatedAt,
          }
        : null,
      evaluation,
      events,
    },
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ slipId: string }> },
) {
  const auth = await requireParent();
  if (auth.error) return auth.error;

  const { slipId } = await context.params;

  let payload: { picks?: unknown };
  try {
    payload = (await request.json()) as { picks?: unknown };
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const picksRaw = Array.isArray(payload.picks) ? payload.picks : [];

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const fresh = await tx.predictionSlip.findUnique({
        where: { id: slipId },
        select: {
          id: true,
          isPublished: true,
          lockedAt: true,
          effectiveClosesAt: true,
          events: {
            orderBy: { sortOrder: "asc" },
            select: { id: true },
          },
        },
      });

      if (!fresh || !fresh.isPublished || !fresh.effectiveClosesAt) {
        throw new PredictionSlipNotFoundError();
      }

      const now = nowAsEuropeRomeWallClockUtc();
      const lock = resolveSlipLockState({
        lockedAt: fresh.lockedAt,
        effectiveClosesAt: fresh.effectiveClosesAt,
        now,
      });

      if (lock.state === "LOCKED") {
        if (lock.shouldPersistLockedAt || fresh.lockedAt == null) {
          await tx.predictionSlip.update({
            where: { id: fresh.id },
            data: { lockedAt: now },
          });
        }
        throw new PredictionSlipClosedError();
      }

      const slipEventIds = fresh.events.map((row) => row.id);
      const validated = validateCompletePicksPayload({
        slipEventIds,
        picks: picksRaw as Array<{ slipEventId: string; choice: string }>,
      });
      if (!validated.ok) {
        throw new PredictionSlipValidationError(validated.error);
      }

      const upserted = await tx.predictionEntry.upsert({
        where: {
          slipId_parentId: {
            slipId: fresh.id,
            parentId: auth.parentProfileId,
          },
        },
        create: {
          slipId: fresh.id,
          parentId: auth.parentProfileId,
        },
        update: {
          updatedAt: new Date(),
        },
        select: { id: true },
      });

      await tx.predictionPick.deleteMany({ where: { entryId: upserted.id } });
      await tx.predictionPick.createMany({
        data: validated.normalized.map((pick) => ({
          entryId: upserted.id,
          slipEventId: pick.slipEventId,
          choice: pick.choice,
        })),
      });

      return upserted;
    });

    return NextResponse.json({
      success: true,
      data: { entryId: entry.id },
    });
  } catch (error) {
    if (error instanceof PredictionSlipNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PredictionSlipClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof PredictionSlipValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
