import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { assertCanManageCategoryForEvents } from "@/lib/category-event-access";
import {
  addWallClockDaysUTC,
  combineWallClockDateAndTime,
  parseDateInputToUTC,
  toDateInputValueUTC,
  wallClockWeekdayUTC,
} from "@/lib/date-input";
import { bulkTrainingSchema } from "@/lib/validation/events";

const MAX_BULK_EVENTS = 500;

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

  const parsed = bulkTrainingSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const categoryAccess = await assertCanManageCategoryForEvents({
    userId: session.user.id,
    role: session.user.role,
    categoryId: parsed.data.categoryId,
  });
  if (!categoryAccess.ok) {
    return NextResponse.json({ error: categoryAccess.error }, { status: categoryAccess.status });
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true, name: true },
  });

  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const weekdays = new Set(parsed.data.weekdays);
  const startDate = parseDateInputToUTC(parsed.data.startDate);
  const endDate = parseDateInputToUTC(parsed.data.endDate);
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Date non valide." }, { status: 400 });
  }

  const data: {
    startAt: Date;
    title: string;
    type: "TRAINING";
    location: string | null;
    description: string | null;
    categoryId: string;
    createdById: string;
  }[] = [];

  for (
    let currentDate = startDate;
    currentDate.getTime() <= endDate.getTime();
    currentDate = addWallClockDaysUTC(currentDate, 1)
  ) {
    if (!weekdays.has(wallClockWeekdayUTC(currentDate))) {
      continue;
    }

    const startAt = combineWallClockDateAndTime(
      toDateInputValueUTC(currentDate),
      parsed.data.time,
    );
    if (!startAt) {
      return NextResponse.json({ error: "Orario non valido." }, { status: 400 });
    }

    data.push({
      title: `Allenamento ${category.name}`,
      type: "TRAINING",
      startAt,
      location: parsed.data.location || null,
      description: parsed.data.notes || null,
      categoryId: category.id,
      createdById: session.user.id,
    });

  }

  if (data.length === 0) {
    return NextResponse.json(
      { error: "Nessuna data utile nel periodo selezionato." },
      { status: 400 },
    );
  }

  if (data.length > MAX_BULK_EVENTS) {
    return NextResponse.json(
      { error: "Troppi eventi da creare in un'unica operazione." },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.event.createMany({ data });
    return NextResponse.json({ success: true, created: created.count }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore durante la creazione massiva degli allenamenti." },
      { status: 500 },
    );
  }
}
