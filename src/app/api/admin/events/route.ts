import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { createEventSchema } from "@/lib/validation/events";

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

  const parsed = createEventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
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
    const createdEvent = await prisma.event.create({
      data: {
        title: parsed.data.title,
        type: parsed.data.type,
        startAt,
        location: parsed.data.location || null,
        description: parsed.data.notes || null,
        categoryId: category.id,
        createdById: session.user.id,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: createdEvent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione evento." }, { status: 500 });
  }
}
