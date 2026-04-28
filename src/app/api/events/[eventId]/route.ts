import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

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
