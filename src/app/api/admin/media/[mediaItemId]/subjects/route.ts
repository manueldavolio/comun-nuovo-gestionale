import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import {
  allowsExternalPublication,
  computeMediaReviewStatus,
  resolveAthletesImageConsentMap,
} from "@/lib/image-consent";
import { prisma } from "@/lib/prisma";
import { assertCanAccessCategoryData } from "@/lib/youth-director-data-access";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ mediaItemId: string }>;
};

const bodySchema = z.object({
  subjectAthleteIds: z.array(z.string().cuid()).max(80),
  subjectsDeclaredComplete: z.boolean(),
  /** Pubblica verso i genitori solo se le verifiche consenso sono OK. */
  publish: z.boolean().optional().default(false),
});

/**
 * Dichiarazione soggetti identificabili + ricalcolo reviewStatus.
 * Area admin/YD: può mostrare esiti consenso; niente payload pubblici anonimi.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { mediaItemId } = await context.params;
  const media = await prisma.mediaItem.findUnique({
    where: { id: mediaItemId },
    select: { id: true, categoryId: true, publishedAt: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media non trovato." }, { status: 404 });
  }

  if (session.user.role === "YOUTH_DIRECTOR") {
    const access = await assertCanAccessCategoryData({
      userId: session.user.id,
      role: session.user.role,
      categoryId: media.categoryId,
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const subjectAthleteIds = Array.from(new Set(parsed.data.subjectAthleteIds));
  if (parsed.data.subjectsDeclaredComplete && subjectAthleteIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "Per chiudere la dichiarazione serve almeno un soggetto identificabile, oppure lascia la dichiarazione incompleta per revisione prudente.",
      },
      { status: 400 },
    );
  }

  if (subjectAthleteIds.length > 0) {
    const athletes = await prisma.athlete.findMany({
      where: { id: { in: subjectAthleteIds }, categoryId: media.categoryId },
      select: { id: true },
    });
    if (athletes.length !== subjectAthleteIds.length) {
      return NextResponse.json(
        { error: "Uno o più soggetti non appartengono alla categoria del media." },
        { status: 400 },
      );
    }
  }

  const consentMap = await resolveAthletesImageConsentMap(subjectAthleteIds);
  const reviewStatus = computeMediaReviewStatus({
    subjectAthleteIds,
    subjectsDeclaredComplete: parsed.data.subjectsDeclaredComplete,
    consentByAthleteId: consentMap,
  });

  const missingConsentAthleteIds = subjectAthleteIds.filter(
    (id) => !allowsExternalPublication(consentMap.get(id)),
  );

  if (parsed.data.publish) {
    if (reviewStatus !== "READY") {
      return NextResponse.json(
        {
          error:
            reviewStatus === "BLOCKED_CONSENT"
              ? "Pubblicazione non consentita: uno o più soggetti non hanno autorizzazione esterna 1.1 valida. Una foto di gruppo non è automaticamente autorizzata."
              : "Pubblicazione non consentita: completa la dichiarazione dei soggetti identificabili (nessuna autorizzazione automatica di squadra).",
          reviewStatus,
          missingConsentCount: missingConsentAthleteIds.length,
        },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.mediaItemSubject.deleteMany({ where: { mediaItemId } });
    if (subjectAthleteIds.length > 0) {
      await tx.mediaItemSubject.createMany({
        data: subjectAthleteIds.map((athleteId) => ({ mediaItemId, athleteId })),
      });
    }

    let publishedAt = media.publishedAt;
    if (parsed.data.publish && reviewStatus === "READY") {
      publishedAt = new Date();
    } else if (reviewStatus !== "READY") {
      // Non visibile ai genitori, ma resta in elenco admin.
      publishedAt = null;
    }

    return tx.mediaItem.update({
      where: { id: mediaItemId },
      data: {
        subjectsDeclaredComplete: parsed.data.subjectsDeclaredComplete,
        reviewStatus,
        publishedAt,
      },
      select: {
        id: true,
        reviewStatus: true,
        publishedAt: true,
        subjectsDeclaredComplete: true,
        _count: { select: { subjects: true } },
      },
    });
  });

  return NextResponse.json({
    success: true,
    data: updated,
    missingConsentCount: missingConsentAthleteIds.length,
  });
}
