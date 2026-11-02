import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import {
  recordAthleteImageConsentChoice,
  recordAthleteImageConsentEvent,
  resolveAthleteImageConsentForPurpose,
} from "@/lib/image-consent";
import { resolveImageConsentRuntimeMode } from "@/lib/legal/image-consent-activation";
import { assertUserParentAssociatedToAthlete } from "@/lib/parent-athletes";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ athleteId: string }>;
};

const dualBodySchema = z.object({
  purpose: z.enum(["INTERNAL", "EXTERNAL"]),
  choice: z.enum(["GRANTED", "DENIED", "DEFERRED"]),
});

const legacyBodySchema = z.object({
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

  const mode = await resolveImageConsentRuntimeMode();
  const [internal, external] = await Promise.all([
    resolveAthleteImageConsentForPurpose(athleteId, "INTERNAL"),
    resolveAthleteImageConsentForPurpose(athleteId, "EXTERNAL"),
  ]);

  return NextResponse.json({
    mode,
    // Compat legacy clients.
    granted: external.granted,
    source: external.source,
    recordedAt: external.recordedAt,
    documentVersion: external.documentVersion,
    internal: {
      choice: internal.choice,
      granted: internal.granted,
      source: internal.source,
      recordedAt: internal.recordedAt,
      documentVersion: internal.documentVersion,
      legacyHistoricalOnly: internal.legacyHistoricalOnly,
    },
    external: {
      choice: external.choice,
      granted: external.granted,
      source: external.source,
      recordedAt: external.recordedAt,
      documentVersion: external.documentVersion,
      legacyHistoricalOnly: external.legacyHistoricalOnly,
    },
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

  const mode = await resolveImageConsentRuntimeMode();

  try {
    if (mode === "dual_v1_1") {
      const parsed = dualBodySchema.safeParse(payload);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
          { status: 400 },
        );
      }
      const result = await recordAthleteImageConsentChoice({
        athleteId,
        purpose: parsed.data.purpose,
        choice: parsed.data.choice,
        actedByUserId: session.user.id,
        source: "parent_area",
      });
      return NextResponse.json({
        success: true,
        mode,
        purpose: result.event.purpose,
        choice: result.event.choice,
        granted: result.event.granted,
        recordedAt: result.event.recordedAt,
        documentVersion: result.event.documentVersion,
        warning: result.warning,
      });
    }

    const parsed = legacyBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
        { status: 400 },
      );
    }
    const event = await recordAthleteImageConsentEvent({
      athleteId,
      granted: parsed.data.granted,
      actedByUserId: session.user.id,
      source: "parent_area",
    });
    return NextResponse.json({
      success: true,
      mode,
      granted: event.granted,
      recordedAt: event.recordedAt,
      documentVersion: event.documentVersion,
      warning: parsed.data.granted
        ? null
        : "Autorizzazione revocata: i nuovi utilizzi per questa finalità saranno sospesi.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DUAL_IMAGE_CONSENT_NOT_ACTIVE") {
      return NextResponse.json(
        { error: "Autorizzazioni immagini 1.1 non ancora attive." },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      (error.message === "IMAGE_CONSENT_INTERNAL_DOCUMENT_MISSING" ||
        error.message === "IMAGE_CONSENT_EXTERNAL_DOCUMENT_MISSING" ||
        error.message === "IMAGE_MEDIA_CONSENT_DOCUMENT_MISSING")
    ) {
      return NextResponse.json(
        { error: "Testo autorizzazione immagini non configurato. Contatta la segreteria." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Impossibile aggiornare l'autorizzazione." }, { status: 500 });
  }
}
