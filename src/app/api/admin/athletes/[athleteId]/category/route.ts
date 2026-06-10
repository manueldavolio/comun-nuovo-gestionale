import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

type CategoryUpdatePayload = {
  categoryId?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ athleteId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { athleteId } = await context.params;

  let payload: CategoryUpdatePayload;
  try {
    payload = (await request.json()) as CategoryUpdatePayload;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const categoryId = typeof payload.categoryId === "string" ? payload.categoryId.trim() : "";
  if (!categoryId) {
    return NextResponse.json({ error: "Categoria non valida." }, { status: 400 });
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, categoryId: true },
  });

  if (!athlete) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }

  if (athlete.categoryId === categoryId) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true },
  });

  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata o non attiva." }, { status: 404 });
  }

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: { categoryId: category.id },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
