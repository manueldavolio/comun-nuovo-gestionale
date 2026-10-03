import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import { prisma } from "@/lib/prisma";
import { updateAthleteProfileSchema } from "@/lib/validation/athlete-profile";

type RouteContext = {
  params: Promise<{ athleteId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

  const parsed = updateAthleteProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
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
    return NextResponse.json({ error: "Non puoi modificare questo atleta." }, { status: 403 });
  }

  const updated = await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      position: parsed.data.position === undefined ? undefined : parsed.data.position,
      shirtNumber: parsed.data.shirtNumber === undefined ? undefined : parsed.data.shirtNumber,
    },
    select: {
      id: true,
      position: true,
      shirtNumber: true,
    },
  });

  return NextResponse.json({ success: true, athlete: updated });
}
