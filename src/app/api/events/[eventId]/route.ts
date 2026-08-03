import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { updateEventSchema } from "@/lib/validation/events";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

async function assertCanManageEvent(options: {
  userId: string;
  role: string;
  eventCategoryId: string | null;
  /** When updating category, also check the target category for coaches. */
  targetCategoryId?: string;
}) {
  const canManageAny = options.role === "ADMIN" || options.role === "YOUTH_DIRECTOR";
  const canManageOwnCategory = options.role === "COACH";

  if (!canManageAny && !canManageOwnCategory) {
    return { ok: false as const, status: 403, error: "Operazione non consentita." };
  }

  if (canManageAny) {
    return { ok: true as const };
  }

  if (!options.eventCategoryId) {
    return {
      ok: false as const,
      status: 403,
      error: "Puoi gestire solo eventi collegati alle tue categorie.",
    };
  }

  const coachCategoryIds = await getCoachCategoryIdsForUser(options.userId);
  if (!coachCategoryIds.includes(options.eventCategoryId)) {
    return {
      ok: false as const,
      status: 403,
      error: "Puoi gestire solo eventi collegati alle tue categorie.",
    };
  }

  if (options.targetCategoryId && !coachCategoryIds.includes(options.targetCategoryId)) {
    return {
      ok: false as const,
      status: 403,
      error: "Non puoi spostare l'evento in una categoria non assegnata.",
    };
  }

  return { ok: true as const };
}

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

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      categoryId: true,
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });
  }

  const access = await assertCanManageEvent({
    userId: session.user.id,
    role: session.user.role,
    eventCategoryId: event.categoryId,
    targetCategoryId: parsed.data.categoryId,
  });

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true },
  });

  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const startAt = new Date(parsed.data.startAt);

  try {
    await prisma.event.update({
      where: { id: event.id },
      data: {
        title: parsed.data.title,
        type: parsed.data.type,
        startAt,
        location: parsed.data.location || null,
        description: parsed.data.notes || null,
        categoryId: category.id,
      },
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

  const role = session.user.role;
  const canDeleteAny = role === "ADMIN" || role === "YOUTH_DIRECTOR";
  const canDeleteOwnCategory = role === "COACH";

  if (!canDeleteAny && !canDeleteOwnCategory) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { eventId } = await context.params;
  if (!eventId) {
    return NextResponse.json({ error: "ID evento non valido." }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      categoryId: true,
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

  if (canDeleteOwnCategory) {
    if (!event.categoryId) {
      return NextResponse.json(
        { error: "Puoi eliminare solo eventi collegati alle tue categorie." },
        { status: 403 },
      );
    }

    const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);
    if (!coachCategoryIds.includes(event.categoryId)) {
      return NextResponse.json(
        { error: "Puoi eliminare solo eventi collegati alle tue categorie." },
        { status: 403 },
      );
    }
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
