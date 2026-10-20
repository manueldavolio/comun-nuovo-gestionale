import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import { isCompetitionKind } from "@/lib/competition-kind";
import { writeDisciplinaryAudit } from "@/lib/discipline-audit";
import { decideUpsertOpeningBalance, seasonLabelFromDate } from "@/lib/discipline";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ athleteId: string }> };

/**
 * PUT: inserisci/modifica situazione disciplinare iniziale (pregresso).
 * Non crea automaticamente squalifiche ledger; openSuspensionMatchdays è informativo
 * finché non esistono DisciplinarySuspension ACTIVE.
 */
export async function PUT(request: Request, context: RouteContext) {
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

  const { athleteId } = await context.params;
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const body = payload as {
    seasonLabel?: unknown;
    competitionKind?: unknown;
    priorYellowCards?: unknown;
    priorYellowCardsForAccumulation?: unknown;
    priorRedCards?: unknown;
    openSuspensionMatchdays?: unknown;
    referenceDate?: unknown;
    notes?: unknown;
  };

  if (!isCompetitionKind(body.competitionKind)) {
    return NextResponse.json({ error: "Competizione non valida." }, { status: 400 });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { seasonLabel: true },
  });

  let referenceDate: Date;
  if (typeof body.referenceDate === "string" && body.referenceDate.trim()) {
    const parsed = new Date(body.referenceDate);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Data di riferimento non valida." }, { status: 400 });
    }
    referenceDate = parsed;
  } else {
    referenceDate = new Date();
  }

  const decision = decideUpsertOpeningBalance({
    seasonLabel:
      typeof body.seasonLabel === "string" && body.seasonLabel.trim()
        ? body.seasonLabel.trim()
        : category?.seasonLabel || seasonLabelFromDate(),
    competitionKind: body.competitionKind,
    priorYellowCards: body.priorYellowCards,
    priorYellowCardsForAccumulation:
      body.priorYellowCardsForAccumulation ?? body.priorYellowCards,
    priorRedCards: body.priorRedCards,
    openSuspensionMatchdays: body.openSuspensionMatchdays,
    referenceDate,
    notes: body.notes,
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  const existing = await prisma.disciplinaryOpeningBalance.findUnique({
    where: {
      athleteId_seasonLabel_competitionKind: {
        athleteId,
        seasonLabel: decision.data.seasonLabel,
        competitionKind: decision.data.competitionKind,
      },
    },
  });

  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.disciplinaryOpeningBalance.upsert({
      where: {
        athleteId_seasonLabel_competitionKind: {
          athleteId,
          seasonLabel: decision.data.seasonLabel,
          competitionKind: decision.data.competitionKind,
        },
      },
      create: {
        athleteId,
        categoryId,
        ...decision.data,
        createdById: session.user.id,
      },
      update: {
        ...decision.data,
        categoryId,
        updatedById: session.user.id,
      },
    });
    await writeDisciplinaryAudit({
      tx,
      entityType: "OPENING_BALANCE",
      entityId: row.id,
      action: existing ? "UPDATE" : "CREATE",
      userId: session.user.id,
      before: existing,
      after: row,
    });
    return row;
  });

  return NextResponse.json({ success: true, data: saved });
}
