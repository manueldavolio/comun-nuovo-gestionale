import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { createMediaItemSchema } from "@/lib/validation/media";
import { parseDateInputToUTC } from "@/lib/date-input";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { assertCanAccessCategoryData } from "@/lib/youth-director-data-access";
import {
  computeMediaReviewStatus,
  resolveAthletesImageConsentMap,
} from "@/lib/image-consent";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const role = session.user.role;
  const canCreate = role === "ADMIN" || role === "YOUTH_DIRECTOR" || role === "COACH";
  if (!canCreate) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = createMediaItemSchema.safeParse(payload);
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

  if (role === "YOUTH_DIRECTOR") {
    const categoryAccess = await assertCanAccessCategoryData({
      userId: session.user.id,
      role: session.user.role,
      categoryId: parsed.data.categoryId,
    });
    if (!categoryAccess.ok) {
      return NextResponse.json(
        { error: categoryAccess.error },
        { status: categoryAccess.status },
      );
    }
  }

  if (role === "COACH") {
    const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);
    if (!coachCategoryIds.includes(parsed.data.categoryId)) {
      return NextResponse.json(
        { error: "Puoi creare media solo per categorie assegnate al tuo profilo." },
        { status: 403 },
      );
    }
  }

  const subjectAthleteIds = Array.from(new Set(parsed.data.subjectAthleteIds));
  if (subjectAthleteIds.length > 0) {
    const athletes = await prisma.athlete.findMany({
      where: {
        id: { in: subjectAthleteIds },
        categoryId: parsed.data.categoryId,
      },
      select: { id: true },
    });
    if (athletes.length !== subjectAthleteIds.length) {
      return NextResponse.json(
        {
          error:
            "Uno o più soggetti non appartengono alla categoria selezionata. Controlla gli atleti dichiarati.",
        },
        { status: 400 },
      );
    }
  }

  const consentMap = await resolveAthletesImageConsentMap(subjectAthleteIds);
  const subjectsDeclaredComplete = Boolean(parsed.data.subjectsDeclaredComplete);
  const reviewStatus = computeMediaReviewStatus({
    subjectAthleteIds,
    subjectsDeclaredComplete,
    consentByAthleteId: consentMap,
  });

  const requestedPublishedAt =
    parsed.data.publishedAt && parsed.data.publishedAt.trim()
      ? parseDateInputToUTC(parsed.data.publishedAt)
      : new Date();

  if (!requestedPublishedAt) {
    return NextResponse.json({ error: "Data pubblicazione non valida." }, { status: 400 });
  }

  // Solo READY può risultare pubblicato verso i genitori.
  const publishedAt = reviewStatus === "READY" ? requestedPublishedAt : null;

  try {
    const created = await prisma.mediaItem.create({
      data: {
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
        mediaType: parsed.data.mediaType,
        categoryId: parsed.data.categoryId,
        createdById: session.user.id,
        filePath: parsed.data.filePath?.trim() ? parsed.data.filePath.trim() : null,
        mediaUrl: parsed.data.mediaUrl?.trim() ? parsed.data.mediaUrl.trim() : null,
        publishedAt,
        subjectsDeclaredComplete,
        reviewStatus,
        subjects: subjectAthleteIds.length
          ? {
              create: subjectAthleteIds.map((athleteId) => ({ athleteId })),
            }
          : undefined,
      },
      select: { id: true, reviewStatus: true, publishedAt: true },
    });

    return NextResponse.json(
      {
        success: true,
        data: created,
        message:
          reviewStatus === "READY"
            ? "Media pubblicato (consensi soggetti verificati)."
            : reviewStatus === "BLOCKED_CONSENT"
              ? "Media salvato ma bloccato: manca il consenso di uno o più soggetti."
              : "Media salvato in revisione: dichiara i soggetti identificabili prima della pubblicazione.",
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione media." }, { status: 500 });
  }
}
