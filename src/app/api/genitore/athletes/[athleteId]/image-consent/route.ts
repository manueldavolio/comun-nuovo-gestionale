import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import {
  recordAthleteImageConsentEvent,
  resolveAthleteImageConsent,
} from "@/lib/image-consent";
import { assertUserParentAssociatedToAthlete } from "@/lib/parent-athletes";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ athleteId: string }>;
};

const bodySchema = z.object({
  granted: z.boolean(),
});

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { athleteId } = await context.params;
  const access = await assertUserParentAssociatedToAthlete({
    userId: session.user.id,
    athleteId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const state = await resolveAthleteImageConsent(athleteId);
  return NextResponse.json({
    granted: state.granted,
    source: state.source,
    recordedAt: state.recordedAt,
    documentVersion: state.documentVersion,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { athleteId } = await context.params;
  const access = await assertUserParentAssociatedToAthlete({
    userId: session.user.id,
    athleteId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
  }

  try {
    const event = await recordAthleteImageConsentEvent({
      athleteId,
      granted: parsed.data.granted,
      actedByUserId: session.user.id,
      source: "parent_area",
    });
    return NextResponse.json({
      success: true,
      granted: event.granted,
      recordedAt: event.recordedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "IMAGE_MEDIA_CONSENT_DOCUMENT_MISSING") {
      return NextResponse.json(
        { error: "Testo consenso immagini non configurato. Contatta la segreteria." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Impossibile aggiornare il consenso." }, { status: 500 });
  }
}
