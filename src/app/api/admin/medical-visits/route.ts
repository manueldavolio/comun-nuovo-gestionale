import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { upsertMedicalVisitSchema } from "@/lib/validation/medical-visits";
import { parseDateInputToUTC } from "@/lib/date-input";
import { computeMedicalVisitStatus } from "@/lib/expiry-status";

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

  const parsed = upsertMedicalVisitSchema.safeParse(payload);
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

  const visitDate = parseDateInputToUTC(parsed.data.visitDate);
  const expiryDate = parseDateInputToUTC(parsed.data.expiryDate);

  if (!visitDate || !expiryDate) {
    return NextResponse.json({ error: "Date non valide." }, { status: 400 });
  }

  const status = computeMedicalVisitStatus(expiryDate);

  try {
    const created = await prisma.medicalVisit.create({
      data: {
        athleteId: parsed.data.athleteId,
        visitDate,
        expiryDate,
        status,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
        certificateFilePath:
          parsed.data.certificateFilePath && parsed.data.certificateFilePath.trim()
            ? parsed.data.certificateFilePath.trim()
            : null,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione visita." }, { status: 500 });
  }
}

