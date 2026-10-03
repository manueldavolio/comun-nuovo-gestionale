import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import { prisma } from "@/lib/prisma";
import { upsertAthleteCoachNoteSchema } from "@/lib/validation/athlete-profile";

type RouteContext = {
  params: Promise<{ athleteId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR" &&
    session.user.role !== "COACH"
  ) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { athleteId } = await context.params;
  if (!athleteId) {
    return NextResponse.json({ error: "Atleta non valido." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = upsertAthleteCoachNoteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  if (parsed.data.year !== currentYear || parsed.data.month !== currentMonth) {
    return NextResponse.json(
      { error: "Puoi modificare solo la nota del mese corrente." },
      { status: 400 },
    );
  }

  const categoryId = await getAthleteCategoryId(athleteId);
  if (!categoryId) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }

  const canManage = await canManageAthleteCategory({
    userId: session.user.id,
    role: session.user.role,
    categoryId,
  });
  if (!canManage) {
    return NextResponse.json({ error: "Non puoi annotare questo atleta." }, { status: 403 });
  }

  const note = await prisma.athleteCoachNote.upsert({
    where: {
      athleteId_year_month: {
        athleteId,
        year: parsed.data.year,
        month: parsed.data.month,
      },
    },
    update: {
      content: parsed.data.content,
      authorId: session.user.id,
    },
    create: {
      athleteId,
      authorId: session.user.id,
      year: parsed.data.year,
      month: parsed.data.month,
      content: parsed.data.content,
    },
    select: {
      id: true,
      year: true,
      month: true,
      content: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, note });
}
