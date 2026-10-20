import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import { isCompetitionKind } from "@/lib/competition-kind";
import { writeDisciplinaryAudit } from "@/lib/discipline-audit";
import { decideCreateSuspension, seasonLabelFromDate } from "@/lib/discipline";
import { prisma } from "@/lib/prisma";

/**
 * POST: assegna giornate di squalifica (dopo comunicato).
 * Crea N serving PENDING — nessuna giornata risulta scontata finché non confermata.
 */
export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (
    session.user.role !== "COACH" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR"
  ) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const body = payload as {
    athleteId?: unknown;
    incidentId?: unknown;
    competitionKind?: unknown;
    seasonLabel?: unknown;
    matchdaysTotal?: unknown;
    officialRef?: unknown;
    decidedAt?: unknown;
    notes?: unknown;
  };

  if (typeof body.athleteId !== "string" || !body.athleteId.trim()) {
    return NextResponse.json({ error: "Atleta non valido." }, { status: 400 });
  }
  if (!isCompetitionKind(body.competitionKind)) {
    return NextResponse.json({ error: "Competizione non valida." }, { status: 400 });
  }
  const competitionKind = body.competitionKind;

  const athleteId = body.athleteId.trim();
  const categoryId = await getAthleteCategoryId(athleteId);
  if (!categoryId) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }
  const allowed = await canManageAthleteCategory({
    userId: session.user.id,
    role: session.user.role,
    categoryId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let incidentId: string | null = null;
  if (typeof body.incidentId === "string" && body.incidentId.trim()) {
    const incident = await prisma.disciplinaryIncident.findFirst({
      where: {
        id: body.incidentId.trim(),
        athleteId,
        status: "ACTIVE",
      },
      select: { id: true, seasonLabel: true, competitionKind: true },
    });
    if (!incident) {
      return NextResponse.json({ error: "Provvedimento non trovato." }, { status: 404 });
    }
    incidentId = incident.id;
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { seasonLabel: true },
  });

  let decidedAt: Date | null = null;
  if (typeof body.decidedAt === "string" && body.decidedAt.trim()) {
    const parsed = new Date(body.decidedAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Data provvedimento non valida." }, { status: 400 });
    }
    decidedAt = parsed;
  }

  const decision = decideCreateSuspension({
    matchdaysTotal: body.matchdaysTotal,
    officialRef: body.officialRef,
    decidedAt,
    notes: body.notes,
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  const seasonLabel =
    typeof body.seasonLabel === "string" && body.seasonLabel.trim()
      ? body.seasonLabel.trim()
      : category?.seasonLabel || seasonLabelFromDate();

  const created = await prisma.$transaction(async (tx) => {
    const suspension = await tx.disciplinarySuspension.create({
      data: {
        incidentId,
        athleteId,
        categoryId,
        seasonLabel,
        competitionKind,
        matchdaysTotal: decision.data.matchdaysTotal,
        officialRef: decision.data.officialRef,
        decidedAt: decision.data.decidedAt,
        notes: decision.data.notes,
        createdById: session.user.id,
        servings: {
          create: Array.from({ length: decision.data.servingsToCreate }, () => ({
            status: "PENDING" as const,
          })),
        },
      },
      include: { servings: true },
    });
    await writeDisciplinaryAudit({
      tx,
      entityType: "SUSPENSION",
      entityId: suspension.id,
      action: "CREATE",
      userId: session.user.id,
      after: suspension,
    });
    return suspension;
  });

  return NextResponse.json({ success: true, data: created });
}
