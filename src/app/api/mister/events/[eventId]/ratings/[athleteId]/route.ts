import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory } from "@/lib/athlete-access";
import { decideMatchRatingAccess } from "@/lib/discipline-api-auth";
import { writeDisciplinaryAudit } from "@/lib/discipline-audit";
import { isMissingDisciplineSchemaError } from "@/lib/discipline-db";
import {
  hasAnyScore,
  normalizeMatchRatingScores,
  normalizeOptionalRatingNotes,
} from "@/lib/match-player-rating";
import { assertStaffCanManageEvent } from "@/lib/session-tools-access";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ eventId: string; athleteId: string }>;
};

/** PUT: upsert valutazione postpartita (staff only). Voti opzionali 1–10. */
export async function PUT(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { eventId, athleteId } = await context.params;
  const gate = await assertStaffCanManageEvent({
    userId: session.user.id,
    role: session.user.role,
    eventId,
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, categoryId: true },
  });
  if (!event?.categoryId) {
    return NextResponse.json({ error: "Evento senza categoria." }, { status: 400 });
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, categoryId: true },
  });
  const athleteBelongs = Boolean(athlete && athlete.categoryId === event.categoryId);
  const canManageCategory =
    athleteBelongs &&
    (await canManageAthleteCategory({
      userId: session.user.id,
      role: session.user.role,
      categoryId: athlete!.categoryId,
    }));

  const access = decideMatchRatingAccess({
    authenticated: true,
    role: session.user.role,
    canManageEvent: gate.ok && canManageCategory,
    athleteBelongsToEventCategory: athleteBelongs,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!athlete) {
    return NextResponse.json({ error: "Atleta non valido per l'evento." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  const body = payload as {
    possessionScore?: unknown;
    outOfPossessionScore?: unknown;
    attitudeScore?: unknown;
    teamworkScore?: unknown;
    notes?: unknown;
  };

  const scores = normalizeMatchRatingScores({
    possessionScore: body.possessionScore,
    outOfPossessionScore: body.outOfPossessionScore,
    attitudeScore: body.attitudeScore,
    teamworkScore: body.teamworkScore,
  });
  if (!scores.ok) {
    return NextResponse.json({ error: scores.error }, { status: 400 });
  }
  const notes = normalizeOptionalRatingNotes(body.notes);
  if (!notes.ok) {
    return NextResponse.json({ error: notes.error }, { status: 400 });
  }

  if (!hasAnyScore(scores.scores) && !notes.notes) {
    return NextResponse.json(
      { error: "Inserire almeno un voto o una nota." },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.matchPlayerRating.findUnique({
      where: { eventId_athleteId: { eventId, athleteId } },
    });

    const saved = await prisma.$transaction(async (tx) => {
      const row = await tx.matchPlayerRating.upsert({
        where: { eventId_athleteId: { eventId, athleteId } },
        create: {
          eventId,
          athleteId,
          ...scores.scores,
          notes: notes.notes,
          createdById: session.user.id,
        },
        update: {
          ...scores.scores,
          notes: notes.notes,
          updatedById: session.user.id,
        },
      });
      await writeDisciplinaryAudit({
        tx,
        entityType: "MATCH_RATING",
        entityId: row.id,
        action: existing ? "UPDATE" : "CREATE",
        userId: session.user.id,
        before: existing,
        after: row,
      });
      return row;
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    if (isMissingDisciplineSchemaError(error)) {
      return NextResponse.json(
        {
          error:
            "Modulo valutazioni non ancora disponibile: applica la migration disciplina.",
        },
        { status: 503 },
      );
    }
    throw error;
  }
}
