import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStaffCanManageEvent } from "@/lib/session-tools-access";
import {
  isTrainingEventType,
  normalizeOptionalText,
  sumSessionDurationMin,
  TRAINING_NOTES_MAX,
  validateSessionItemsPayload,
} from "@/lib/training-session";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { eventId } = await context.params;
  const access = await assertStaffCanManageEvent({
    userId: session.user.id,
    role: session.user.role,
    eventId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      type: true,
      startAt: true,
      category: { select: { id: true, name: true } },
      trainingSession: {
        select: {
          id: true,
          notes: true,
          updatedAt: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              exerciseId: true,
              title: true,
              description: true,
              durationMin: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });
  }
  if (!isTrainingEventType(event.type)) {
    return NextResponse.json(
      { error: "Il programma seduta è disponibile solo per gli allenamenti." },
      { status: 400 },
    );
  }

  const items = event.trainingSession?.items ?? [];
  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      type: event.type,
      startAt: event.startAt,
      category: event.category,
    },
    session: event.trainingSession
      ? {
          id: event.trainingSession.id,
          notes: event.trainingSession.notes,
          updatedAt: event.trainingSession.updatedAt,
          items,
          totalDurationMin: sumSessionDurationMin(items),
        }
      : null,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { eventId } = await context.params;
  const access = await assertStaffCanManageEvent({
    userId: session.user.id,
    role: session.user.role,
    eventId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, type: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });
  }
  if (!isTrainingEventType(event.type)) {
    return NextResponse.json(
      { error: "Il programma seduta è disponibile solo per gli allenamenti." },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const body = payload as { notes?: unknown; items?: unknown };
  const notesResult = normalizeOptionalText(body.notes, TRAINING_NOTES_MAX, "Nota");
  if (!notesResult.ok) {
    return NextResponse.json({ error: notesResult.error }, { status: 400 });
  }
  const itemsResult = validateSessionItemsPayload(body.items ?? []);
  if (!itemsResult.ok) {
    return NextResponse.json({ error: itemsResult.error }, { status: 400 });
  }

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.trainingSession.findUnique({
      where: { eventId },
      select: { id: true },
    });

    const trainingSession = existing
      ? await tx.trainingSession.update({
          where: { id: existing.id },
          data: { notes: notesResult.value },
        })
      : await tx.trainingSession.create({
          data: {
            eventId,
            notes: notesResult.value,
            createdById: session.user.id,
          },
        });

    await tx.trainingSessionItem.deleteMany({
      where: { sessionId: trainingSession.id },
    });

    if (itemsResult.items.length > 0) {
      await tx.trainingSessionItem.createMany({
        data: itemsResult.items.map((item) => ({
          sessionId: trainingSession.id,
          exerciseId: item.exerciseId,
          title: item.title,
          description: item.description,
          durationMin: item.durationMin,
          sortOrder: item.sortOrder,
        })),
      });
    }

    return tx.trainingSession.findUniqueOrThrow({
      where: { id: trainingSession.id },
      select: {
        id: true,
        notes: true,
        updatedAt: true,
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            exerciseId: true,
            title: true,
            description: true,
            durationMin: true,
            sortOrder: true,
          },
        },
      },
    });
  });

  return NextResponse.json({
    session: {
      ...saved,
      totalDurationMin: sumSessionDurationMin(saved.items),
    },
  });
}
