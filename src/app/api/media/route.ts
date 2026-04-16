import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { createMediaItemSchema } from "@/lib/validation/media";
import { parseDateInputToUTC } from "@/lib/date-input";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";

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

  if (role === "COACH") {
    const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);
    if (!coachCategoryIds.includes(parsed.data.categoryId)) {
      return NextResponse.json(
        { error: "Puoi creare media solo per categorie assegnate al tuo profilo." },
        { status: 403 },
      );
    }
  }

  const publishedAt =
    parsed.data.publishedAt && parsed.data.publishedAt.trim()
      ? parseDateInputToUTC(parsed.data.publishedAt)
      : new Date();

  if (!publishedAt) {
    return NextResponse.json({ error: "Data pubblicazione non valida." }, { status: 400 });
  }

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
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione media." }, { status: 500 });
  }
}
