import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import {
  assertCanManageEventForStaff,
  assertCanManageEventMoveForStaff,
} from "@/lib/category-event-access";
import {
  buildCompetitionPersistFields,
  updateEventCompatible,
} from "@/lib/event-competition-persist";
import { updateEventSchema } from "@/lib/validation/events";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { eventId } = await context.params;
  if (!eventId) {
    return NextResponse.json({ error: "ID evento non valido." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = updateEventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const access = await assertCanManageEventMoveForStaff({
    userId: session.user.id,
    role: session.user.role,
    eventId,
    targetCategoryId: parsed.data.categoryId,
  });

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true, seasonLabel: true },
  });

  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const startAt = new Date(parsed.data.startAt);
  const competition = buildCompetitionPersistFields({
    type: parsed.data.type,
    competitionKind: parsed.data.competitionKind,
    categorySeasonLabel: category.seasonLabel,
  });

  try {
    await updateEventCompatible({
      eventId,
      base: {
        title: parsed.data.title,
        type: parsed.data.type,
        startAt,
        location: parsed.data.location || null,
        description: parsed.data.notes || null,
        categoryId: category.id,
      },
      competition,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Errore durante l'aggiornamento dell'evento." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { eventId } = await context.params;
  if (!eventId) {
    return NextResponse.json({ error: "ID evento non valido." }, { status: 400 });
  }

  const access = await assertCanManageEventForStaff({
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
      _count: {
        select: {
          attendances: true,
        },
      },
      convocation: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });
  }

  if (event._count.attendances > 0 || event.convocation) {
    return NextResponse.json(
      {
        error:
          "Non puoi eliminare questo evento perché ha dati collegati (presenze o convocazioni).",
      },
      { status: 409 },
    );
  }

  try {
    await prisma.event.delete({
      where: {
        id: event.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Errore durante l'eliminazione dell'evento." }, { status: 500 });
  }
}
