import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { upsertDocumentSchema } from "@/lib/validation/documents";
import { parseDateInputToUTC } from "@/lib/date-input";

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

  const parsed = upsertDocumentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: parsed.data.athleteId },
    select: { id: true },
  });

  if (!athlete) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }

  const expiryDate =
    parsed.data.expiryDate && parsed.data.expiryDate.trim()
      ? parseDateInputToUTC(parsed.data.expiryDate)
      : null;

  if (parsed.data.expiryDate && parsed.data.expiryDate.trim() && !expiryDate) {
    return NextResponse.json({ error: "Data scadenza non valida." }, { status: 400 });
  }

  try {
    const created = await prisma.document.create({
      data: {
        athleteId: parsed.data.athleteId,
        type: parsed.data.type,
        title: parsed.data.title.trim(),
        filePath: parsed.data.filePath.trim(),
        expiryDate,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione documento." }, { status: 500 });
  }
}

