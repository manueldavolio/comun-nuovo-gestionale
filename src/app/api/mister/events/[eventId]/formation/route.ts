import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  resolveOperationalStatus,
  OPERATIONAL_STATUS_LABEL,
} from "@/lib/athlete-operational-status";
import { resolvePlayersPerSide } from "@/lib/category-format";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import {
  athleteNotInConvocationWarning,
  isFormationModuleId,
  isMatchFormationEventType,
  validateFormationSlots,
} from "@/lib/match-formation";
import { prisma } from "@/lib/prisma";
import { assertStaffCanManageEvent } from "@/lib/session-tools-access";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { eventId } = await context.params;
  const access = await assertStaffCanManageEvent({
    userId: session.user.id,
    role: session.user.role,
    eventId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const wallNow = nowAsEuropeRomeWallClockUtc();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      type: true,
      startAt: true,
      opponentName: true,
      categoryId: true,
      category: { select: { id: true, name: true, playersPerSide: true } },
      convocation: {
        select: {
          id: true,
          athletes: { select: { athleteId: true } },
        },
      },
      matchFormation: {
        select: {
          id: true,
          module: true,
          updatedAt: true,
          slots: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              slotKey: true,
              athleteId: true,
              isBench: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });
  }
  if (!isMatchFormationEventType(event.type)) {
    return NextResponse.json(
      { error: "La formazione è disponibile solo per le partite." },
      { status: 400 },
    );
  }
  if (!event.categoryId || !event.category) {
    return NextResponse.json(
      { error: "Evento senza categoria." },
      { status: 400 },
    );
  }

  const convocatedIds = new Set(
    event.convocation?.athletes.map((a) => a.athleteId) ?? [],
  );
  const hasConvocation = Boolean(event.convocation);

  const rosterWhere = hasConvocation
    ? { id: { in: [...convocatedIds] }, categoryId: event.categoryId }
    : { categoryId: event.categoryId };

  // Prefer convocati; se convocazione vuota/assente usa rosa categoria.
  // Se c'è convocazione mostriamo anche rosa per warning su fuori-lista.
  const [poolAthletes, rosterAthletes] = await Promise.all([
    prisma.athlete.findMany({
      where: hasConvocation && convocatedIds.size > 0 ? rosterWhere : { categoryId: event.categoryId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        shirtNumber: true,
        operationalStatus: {
          select: { status: true, note: true, validUntil: true },
        },
      },
    }),
    prisma.athlete.findMany({
      where: { categoryId: event.categoryId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        shirtNumber: true,
        operationalStatus: {
          select: { status: true, note: true, validUntil: true },
        },
      },
    }),
  ]);

  const mapAthlete = (
    athlete: (typeof rosterAthletes)[number],
    inConvocation: boolean | null,
  ) => {
    const resolved = resolveOperationalStatus({
      record: athlete.operationalStatus,
      wallNow,
    });
    return {
      id: athlete.id,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      position: athlete.position,
      shirtNumber: athlete.shirtNumber,
      operationalStatus: resolved.status,
      operationalLabel: OPERATIONAL_STATUS_LABEL[resolved.status],
      inConvocation,
      notInConvocationWarning:
        hasConvocation && !inConvocation
          ? athleteNotInConvocationWarning(athlete.id, convocatedIds)
          : null,
    };
  };

  const pool = poolAthletes.map((a) =>
    mapAthlete(a, hasConvocation ? convocatedIds.has(a.id) : null),
  );
  const roster = rosterAthletes.map((a) =>
    mapAthlete(a, hasConvocation ? convocatedIds.has(a.id) : null),
  );

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      type: event.type,
      startAt: event.startAt,
      opponentName: event.opponentName,
      category: event.category,
      playersPerSide: resolvePlayersPerSide(event.category),
      hasConvocation,
    },
    pool,
    roster,
    formation: event.matchFormation
      ? {
          id: event.matchFormation.id,
          module: event.matchFormation.module,
          updatedAt: event.matchFormation.updatedAt,
          slots: event.matchFormation.slots,
        }
      : null,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { eventId } = await context.params;
  const access = await assertStaffCanManageEvent({
    userId: session.user.id,
    role: session.user.role,
    eventId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      type: true,
      categoryId: true,
      category: { select: { id: true, name: true, playersPerSide: true } },
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });
  }
  if (!isMatchFormationEventType(event.type)) {
    return NextResponse.json(
      { error: "La formazione è disponibile solo per le partite." },
      { status: 400 },
    );
  }
  if (!event.categoryId || !event.category) {
    return NextResponse.json({ error: "Evento senza categoria." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const body = payload as { module?: unknown; slots?: unknown };
  if (!isFormationModuleId(body.module)) {
    return NextResponse.json({ error: "Modulo non valido." }, { status: 400 });
  }
  const moduleId = body.module;
  const playersPerSide = resolvePlayersPerSide(event.category);

  const roster = await prisma.athlete.findMany({
    where: { categoryId: event.categoryId },
    select: { id: true },
  });
  const allowedAthleteIds = new Set(roster.map((a) => a.id));

  const slotsRaw = Array.isArray(body.slots) ? body.slots : [];
  const validated = validateFormationSlots({
    module: moduleId,
    playersPerSide,
    slots: slotsRaw as Array<{
      slotKey: unknown;
      athleteId?: unknown;
      isBench?: unknown;
      sortOrder?: unknown;
    }>,
    allowedAthleteIds,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.matchFormation.findUnique({
      where: { eventId },
      select: { id: true },
    });

    const formation = existing
      ? await tx.matchFormation.update({
          where: { id: existing.id },
          data: { module: moduleId },
        })
      : await tx.matchFormation.create({
          data: {
            eventId,
            module: moduleId,
            createdById: session.user.id,
          },
        });

    await tx.matchFormationSlot.deleteMany({
      where: { formationId: formation.id },
    });

    if (validated.slots.length > 0) {
      await tx.matchFormationSlot.createMany({
        data: validated.slots.map((slot) => ({
          formationId: formation.id,
          slotKey: slot.slotKey,
          athleteId: slot.athleteId,
          isBench: slot.isBench,
          sortOrder: slot.sortOrder,
        })),
      });
    }

    return tx.matchFormation.findUniqueOrThrow({
      where: { id: formation.id },
      select: {
        id: true,
        module: true,
        updatedAt: true,
        slots: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            slotKey: true,
            athleteId: true,
            isBench: true,
            sortOrder: true,
          },
        },
      },
    });
  });

  return NextResponse.json({ formation: saved });
}
