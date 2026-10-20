import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import { isCompetitionKind } from "@/lib/competition-kind";
import { decideDisciplineApiAccess } from "@/lib/discipline-api-auth";
import { writeDisciplinaryAudit } from "@/lib/discipline-audit";
import { isMissingDisciplineSchemaError } from "@/lib/discipline-db";
import {
  isDisciplinarySanctionType,
  normalizeOptionalMinute,
  normalizeOptionalNotes,
  seasonLabelFromDate,
} from "@/lib/discipline";
import { prisma } from "@/lib/prisma";

/**
 * POST: registra cartellino/provvedimento.
 * Body: { athleteId, eventId?, type, competitionKind?, seasonLabel?, minute?, notes? }
 * NON crea squalifiche automatiche.
 */
export async function POST(request: Request) {
  const session = await getAuthSession();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const body = payload as {
    athleteId?: unknown;
    eventId?: unknown;
    type?: unknown;
    competitionKind?: unknown;
    seasonLabel?: unknown;
    minute?: unknown;
    notes?: unknown;
  };

  if (typeof body.athleteId !== "string" || !body.athleteId.trim()) {
    return NextResponse.json({ error: "Atleta non valido." }, { status: 400 });
  }
  if (!isDisciplinarySanctionType(body.type)) {
    return NextResponse.json({ error: "Tipo provvedimento non valido." }, { status: 400 });
  }
  const sanctionType = body.type;

  const athleteId = body.athleteId.trim();
  const categoryId = await getAthleteCategoryId(athleteId);
  if (!categoryId) {
    const early = decideDisciplineApiAccess({
      authenticated: Boolean(session?.user?.id),
      role: session?.user?.role,
      canManageTargetCategory: false,
    });
    if (!early.ok) {
      return NextResponse.json({ error: early.error }, { status: early.status });
    }
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }

  const allowed = session?.user?.id
    ? await canManageAthleteCategory({
        userId: session.user.id,
        role: session.user.role,
        categoryId,
      })
    : false;
  const access = decideDisciplineApiAccess({
    authenticated: Boolean(session?.user?.id),
    role: session?.user?.role,
    canManageTargetCategory: allowed,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { seasonLabel: true },
  });

  let eventId: string | null = null;
  let competitionKind = isCompetitionKind(body.competitionKind)
    ? body.competitionKind
    : null;
  let seasonLabel =
    typeof body.seasonLabel === "string" && body.seasonLabel.trim()
      ? body.seasonLabel.trim()
      : category?.seasonLabel || seasonLabelFromDate();

  if (typeof body.eventId === "string" && body.eventId.trim()) {
    const event = await prisma.event.findUnique({
      where: { id: body.eventId.trim() },
      select: {
        id: true,
        categoryId: true,
        competitionKind: true,
        seasonLabel: true,
        type: true,
      },
    });
    if (!event || event.categoryId !== categoryId) {
      return NextResponse.json({ error: "Evento non valido per l'atleta." }, { status: 400 });
    }
    eventId = event.id;
    competitionKind = competitionKind ?? event.competitionKind;
    seasonLabel = event.seasonLabel || seasonLabel;
  }

  if (!competitionKind) {
    return NextResponse.json(
      { error: "Indicare la competizione (campionato/coppa/…)." },
      { status: 400 },
    );
  }

  const minute = normalizeOptionalMinute(body.minute);
  if (!minute.ok) {
    return NextResponse.json({ error: minute.error }, { status: 400 });
  }
  const notes = normalizeOptionalNotes(body.notes);
  if (!notes.ok) {
    return NextResponse.json({ error: notes.error }, { status: 400 });
  }

  // Anti-duplicato soft: stesso atleta/evento/tipo ACTIVE.
  if (eventId) {
    const duplicate = await prisma.disciplinaryIncident.findFirst({
      where: {
        athleteId,
        eventId,
        type: sanctionType,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Provvedimento già registrato per questa gara." },
        { status: 409 },
      );
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.disciplinaryIncident.create({
        data: {
          athleteId,
          categoryId,
          eventId,
          seasonLabel,
          competitionKind,
          type: sanctionType,
          minute: minute.minute,
          notes: notes.notes,
          createdById: session.user.id,
        },
      });
      await writeDisciplinaryAudit({
        tx,
        entityType: "INCIDENT",
        entityId: row.id,
        action: "CREATE",
        userId: session.user.id,
        after: row,
      });
      return row;
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    if (isMissingDisciplineSchemaError(error)) {
      return NextResponse.json(
        {
          error:
            "Modulo disciplinare non ancora disponibile: applica la migration disciplina.",
        },
        { status: 503 },
      );
    }
    throw error;
  }
}
