import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { bulkTrainingSchema } from "@/lib/validation/events";

const MAX_BULK_EVENTS = 500;

function buildTrainingDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateOnly(date: Date) {
  const onlyDate = new Date(date);
  onlyDate.setHours(0, 0, 0, 0);
  return onlyDate;
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

  const parsed = bulkTrainingSchema.safeParse(payload);
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

  const weekdays = new Set(parsed.data.weekdays);
  const startDate = toDateOnly(new Date(`${parsed.data.startDate}T00:00:00`));
  const endDate = toDateOnly(new Date(`${parsed.data.endDate}T00:00:00`));
  const data: { startAt: Date; title: string; type: "TRAINING"; location: string | null; description: string | null; categoryId: string; createdById: string }[] =
    [];

  for (
    const currentDate = new Date(startDate);
    currentDate.getTime() <= endDate.getTime();
    currentDate.setDate(currentDate.getDate() + 1)
  ) {
    if (!weekdays.has(currentDate.getDay())) {
      continue;
    }

    data.push({
      title: `Allenamento ${category.name}`,
      type: "TRAINING",
      startAt: buildTrainingDate(formatDateForInput(currentDate), parsed.data.time),
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
