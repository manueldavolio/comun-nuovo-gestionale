import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN } from "@/lib/athlete-medical-notes";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ athleteId: string }>;
};

/**
 * Svuota Athlete.medicalNotes solo su azione ADMIN esplicita e confermata.
 * Non tocca certificati, visite mediche o altri allegati.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { athleteId } = await context.params;
  if (!athleteId?.trim()) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const confirm =
    payload && typeof payload === "object" && "confirm" in payload
      ? String((payload as { confirm?: unknown }).confirm ?? "").trim()
      : "";

  if (confirm !== ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN) {
    return NextResponse.json(
      {
        error: `Conferma non valida. Digita ${ATHLETE_MEDICAL_NOTES_CLEAR_TOKEN} per procedere.`,
      },
      { status: 400 },
    );
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, medicalNotes: true },
  });
  if (!athlete) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }

  if (!athlete.medicalNotes?.trim()) {
    return NextResponse.json({
      success: true,
      note: "Nessuna nota medica da svuotare.",
      alreadyEmpty: true,
    });
  }

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: { medicalNotes: null },
    select: { id: true },
  });

  return NextResponse.json({
    success: true,
    note: "Note mediche storiche svuotate. Certificati e visite non sono stati modificati.",
  });
}
