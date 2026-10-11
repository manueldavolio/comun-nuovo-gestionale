import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { decideReactivateAthlete } from "@/lib/athlete-roster-status";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ athleteId: string }>;
};

/** POST: riattiva un atleta ritirato (torna in rosa ACTIVE). */
export async function POST(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { athleteId } = await context.params;
  if (!athleteId?.trim()) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      rosterStatus: true,
    },
  });
  if (!athlete) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }

  const decision = decideReactivateAthlete(athlete.rosterStatus);
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  const updated = await prisma.$transaction(async (tx) => {
    return tx.athlete.update({
      where: { id: athlete.id },
      data: decision.data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rosterStatus: true,
        withdrawnAt: true,
        withdrawReason: true,
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: "Atleta riattivato in rosa.",
    data: updated,
  });
}
