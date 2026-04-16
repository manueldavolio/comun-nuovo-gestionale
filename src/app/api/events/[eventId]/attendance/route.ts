import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageEventAttendance } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { updateAttendanceSchema } from "@/lib/validation/attendance";

export async function PUT(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR" &&
    session.user.role !== "COACH"
  ) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { eventId } = await context.params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = updateAttendanceSchema.safeParse(payload);
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

  const canManage = await canManageEventAttendance({
    userId: session.user.id,
    role: session.user.role,
    eventId: event.id,
  });

  if (!canManage) {
    return NextResponse.json({ error: "Non puoi gestire questo evento." }, { status: 403 });
  }

  if (!event.categoryId) {
    return NextResponse.json(
      { error: "L'evento non e collegato a una categoria." },
      { status: 400 },
    );
  }

  const athletes = await prisma.athlete.findMany({
    where: {
      categoryId: event.categoryId,
    },
    select: { id: true },
  });
  const athleteIds = new Set(athletes.map((athlete) => athlete.id));

  const hasInvalidAthlete = parsed.data.entries.some((entry) => !athleteIds.has(entry.athleteId));
  if (hasInvalidAthlete) {
    return NextResponse.json(
      { error: "Uno o piu atleti non appartengono alla categoria dell'evento." },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    parsed.data.entries.map((entry) =>
      prisma.attendance.upsert({
        where: {
          athleteId_eventId: {
            athleteId: entry.athleteId,
            eventId: event.id,
          },
        },
        update: {
          status: entry.status,
        },
        create: {
          athleteId: entry.athleteId,
          eventId: event.id,
          status: entry.status,
        },
      }),
    ),
  );

  return NextResponse.json({ success: true, updated: parsed.data.entries.length });
}
