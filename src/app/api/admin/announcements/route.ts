import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { createAnnouncementSchema } from "@/lib/validation/announcements";
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

  const parsed = createAnnouncementSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const categoryId = parsed.data.categoryId?.trim() ? parsed.data.categoryId : null;
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
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
    const created = await prisma.announcement.create({
      data: {
        title: parsed.data.title.trim(),
        content: parsed.data.content.trim(),
        audience: parsed.data.audience,
        categoryId,
        publishedAt,
        createdById: session.user.id,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione comunicazione." }, { status: 500 });
  }
}
