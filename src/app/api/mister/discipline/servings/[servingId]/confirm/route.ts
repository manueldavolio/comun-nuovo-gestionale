import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory } from "@/lib/athlete-access";
import { canServeSuspensionOnEvent } from "@/lib/competition-kind";
import { writeDisciplinaryAudit } from "@/lib/discipline-audit";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ servingId: string }> };

/**
 * POST: conferma esplicita giornata scontata.
 * Body opzionale: { eventId?, notes?, allowCrossCompetition? }
 * NON auto-sconta se l'atleta manca dalla distinta.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (
    session.user.role !== "COACH" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR"
  ) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { servingId } = await context.params;
  const serving = await prisma.disciplinarySuspensionServing.findUnique({
    where: { id: servingId },
    include: {
      suspension: true,
    },
  });
  if (!serving) {
    return NextResponse.json({ error: "Giornata non trovata." }, { status: 404 });
  }
  if (serving.suspension.status !== "ACTIVE") {
    return NextResponse.json({ error: "Squalifica non attiva." }, { status: 409 });
  }
  if (serving.status === "SERVED") {
    return NextResponse.json({ error: "Giornata già scontata." }, { status: 409 });
  }
  if (serving.status === "CANCELLED") {
    return NextResponse.json({ error: "Giornata annullata." }, { status: 409 });
  }

  const allowed = await canManageAthleteCategory({
    userId: session.user.id,
    role: session.user.role,
    categoryId: serving.suspension.categoryId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: {
    eventId?: unknown;
    notes?: unknown;
    allowCrossCompetition?: unknown;
  } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    // body opzionale
  }

  let eventId: string | null = null;
  if (typeof payload.eventId === "string" && payload.eventId.trim()) {
    const event = await prisma.event.findUnique({
      where: { id: payload.eventId.trim() },
      select: {
        id: true,
        categoryId: true,
        competitionKind: true,
        countsForDiscipline: true,
      },
    });
    if (!event || event.categoryId !== serving.suspension.categoryId) {
      return NextResponse.json({ error: "Evento non valido." }, { status: 400 });
    }
    const ok = canServeSuspensionOnEvent({
      suspensionKind: serving.suspension.competitionKind,
      eventKind: event.competitionKind,
      eventCountsForDiscipline: event.countsForDiscipline,
      allowCrossCompetition: payload.allowCrossCompetition === true,
    });
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "La gara non è idonea per scontare questa squalifica (competizione diversa o amichevole).",
        },
        { status: 400 },
      );
    }
    eventId = event.id;
  }

  const notes =
    typeof payload.notes === "string"
      ? payload.notes.trim().slice(0, 500) || null
      : null;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.disciplinarySuspensionServing.update({
      where: { id: servingId },
      data: {
        status: "SERVED",
        eventId,
        confirmedAt: nowAsEuropeRomeWallClockUtc(),
        confirmedById: session.user.id,
        notes,
      },
    });
    await writeDisciplinaryAudit({
      tx,
      entityType: "SERVING",
      entityId: row.id,
      action: "SERVE",
      userId: session.user.id,
      before: serving,
      after: row,
    });
    return row;
  });

  return NextResponse.json({ success: true, data: updated });
}
