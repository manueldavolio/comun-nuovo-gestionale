import { NextResponse } from "next/server";
import type { EventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { bulkDeleteEventsSchema } from "@/lib/validation/events";

function toDateOnly(date: Date) {
  const onlyDate = new Date(date);
  onlyDate.setHours(0, 0, 0, 0);
  return onlyDate;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = bulkDeleteEventsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true, name: true },
  });

  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const rangeStart = toDateOnly(new Date(`${parsed.data.startDate}T00:00:00`));
  const rangeEnd = endOfDay(toDateOnly(new Date(`${parsed.data.endDate}T00:00:00`)));

  const typeFilter: Prisma.EventWhereInput =
    parsed.data.type === "ALL"
      ? {}
      : { type: parsed.data.type as EventType };

  const candidates = await prisma.event.findMany({
    where: {
      categoryId: category.id,
      startAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
      ...typeFilter,
    },
    select: {
      id: true,
      _count: {
        select: {
          attendances: true,
        },
      },
      convocation: {
        select: { id: true },
      },
    },
  });

  const deletableIds = candidates
    .filter((event) => event._count.attendances === 0 && !event.convocation)
    .map((event) => event.id);
  const skipped = candidates.length - deletableIds.length;

  if (deletableIds.length === 0) {
    return NextResponse.json(
      {
        error:
          skipped > 0
            ? `Nessun evento eliminabile: ${skipped} hanno presenze o convocazioni collegate.`
            : "Nessun evento trovato nel periodo selezionato.",
        deleted: 0,
        skipped,
      },
      { status: 400 },
    );
  }

  try {
    const deleted = await prisma.event.deleteMany({
      where: {
        id: { in: deletableIds },
      },
    });

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
      skipped,
      categoryName: category.name,
    });
  } catch {
    return NextResponse.json(
      { error: "Errore durante la cancellazione massiva degli eventi." },
      { status: 500 },
    );
  }
}
