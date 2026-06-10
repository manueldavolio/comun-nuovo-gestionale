import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { upsertCategorySchema } from "@/lib/validation/categories";

export async function PUT(
  request: Request,
  context: { params: Promise<{ categoryId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { categoryId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = upsertCategorySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  try {
    await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: parsed.data.name.trim(),
        birthYearsLabel: parsed.data.birthYearsLabel.trim(),
        isActive: parsed.data.isActive,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Esiste gia una categoria con lo stesso nome per questa stagione." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Errore durante l'aggiornamento categoria." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ categoryId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { categoryId } = await context.params;

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      _count: {
        select: {
          athletes: true,
          enrollments: true,
          events: true,
          announcements: true,
          convocations: true,
          monthlyCoachReports: true,
          mediaItems: true,
        },
      },
    },
  });
  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const counts = category._count;
  const hasLinkedData =
    counts.athletes > 0 ||
    counts.enrollments > 0 ||
    counts.events > 0 ||
    counts.announcements > 0 ||
    counts.convocations > 0 ||
    counts.monthlyCoachReports > 0 ||
    counts.mediaItems > 0;

  try {
    if (hasLinkedData) {
      // Soft delete: non eliminare mai dati collegati (atleti, iscrizioni, eventi, ecc.).
      await prisma.category.update({
        where: { id: categoryId },
        data: { isActive: false },
      });
      return NextResponse.json(
        {
          success: true,
          deactivated: true,
          message: "Categoria disattivata perché contiene dati collegati.",
        },
        { status: 200 },
      );
    }

    await prisma.category.delete({ where: { id: categoryId } });
    return NextResponse.json({ success: true, deleted: true }, { status: 200 });
  } catch (error) {
    // P2003: vincolo di integrità referenziale, fallback alla disattivazione.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      await prisma.category.update({
        where: { id: categoryId },
        data: { isActive: false },
      });
      return NextResponse.json(
        {
          success: true,
          deactivated: true,
          message: "Categoria disattivata perché contiene dati collegati.",
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: "Errore durante l'eliminazione categoria." }, { status: 500 });
  }
}
