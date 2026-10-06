import { NextResponse } from "next/server";
import type { AthleteOperationalStatusType } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import {
  endOfWallClockDayFromDateInput,
  isOperationalStatusType,
  normalizeOperationalNote,
  resolveOperationalStatus,
} from "@/lib/athlete-operational-status";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ athleteId: string }>;
};

async function assertCanManageAthlete(options: {
  userId: string;
  role: string;
  athleteId: string;
}) {
  if (
    options.role !== "ADMIN" &&
    options.role !== "YOUTH_DIRECTOR" &&
    options.role !== "COACH"
  ) {
    return { ok: false as const, status: 403 as const, error: "Operazione non consentita." };
  }

  const categoryId = await getAthleteCategoryId(options.athleteId);
  if (!categoryId) {
    return { ok: false as const, status: 404 as const, error: "Atleta non trovato." };
  }

  const canManage = await canManageAthleteCategory({
    userId: options.userId,
    role: options.role as "ADMIN" | "YOUTH_DIRECTOR" | "COACH" | "PARENT",
    categoryId,
  });
  if (!canManage) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Non puoi aggiornare la disponibilità di questo atleta.",
    };
  }

  return { ok: true as const };
}

/**
 * PUT body:
 * { status, note?, validUntilDate?: string | null }
 * - status AVAILABLE => delete record
 * - validUntilDate YYYY-MM-DD => end of that Rome wall-clock day
 * - validUntilDate null/omit with non-AVAILABLE => no expiry (if field omitted keep existing on upsert create uses null)
 */
export async function PUT(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { athleteId } = await context.params;
  if (!athleteId) {
    return NextResponse.json({ error: "Atleta non valido." }, { status: 400 });
  }

  const access = await assertCanManageAthlete({
    userId: session.user.id,
    role: session.user.role,
    athleteId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const body = payload as {
    status?: unknown;
    note?: unknown;
    validUntilDate?: unknown;
  };

  if (!isOperationalStatusType(body.status)) {
    return NextResponse.json({ error: "Stato non valido." }, { status: 400 });
  }

  const noteResult = normalizeOperationalNote(body.note);
  if (!noteResult.ok) {
    return NextResponse.json({ error: noteResult.error }, { status: 400 });
  }

  const wallNow = nowAsEuropeRomeWallClockUtc();

  // AVAILABLE => delete (assenza record = disponibile)
  if (body.status === "AVAILABLE") {
    await prisma.athleteOperationalStatus.deleteMany({ where: { athleteId } });
    const resolved = resolveOperationalStatus({ record: null, wallNow });
    return NextResponse.json({
      success: true,
      status: resolved.status,
      note: null,
      validUntil: null,
    });
  }

  let validUntil: Date | null = null;
  if (body.validUntilDate === null || body.validUntilDate === "") {
    validUntil = null;
  } else if (typeof body.validUntilDate === "string") {
    const parsed = endOfWallClockDayFromDateInput(body.validUntilDate.trim());
    if (!parsed) {
      return NextResponse.json({ error: "Data di scadenza non valida." }, { status: 400 });
    }
    validUntil = parsed;
  } else if (body.validUntilDate !== undefined) {
    return NextResponse.json({ error: "Data di scadenza non valida." }, { status: 400 });
  }

  const row = await prisma.athleteOperationalStatus.upsert({
    where: { athleteId },
    create: {
      athleteId,
      status: body.status as AthleteOperationalStatusType,
      note: noteResult.note,
      setById: session.user.id,
      validUntil,
    },
    update: {
      status: body.status as AthleteOperationalStatusType,
      note: noteResult.note,
      setById: session.user.id,
      ...(body.validUntilDate !== undefined ? { validUntil } : {}),
    },
    select: {
      status: true,
      note: true,
      validUntil: true,
    },
  });

  const resolved = resolveOperationalStatus({ record: row, wallNow });
  return NextResponse.json({
    success: true,
    status: resolved.status,
    note: resolved.note,
    validUntil: resolved.validUntil,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { athleteId } = await context.params;
  if (!athleteId) {
    return NextResponse.json({ error: "Atleta non valido." }, { status: 400 });
  }

  const access = await assertCanManageAthlete({
    userId: session.user.id,
    role: session.user.role,
    athleteId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  await prisma.athleteOperationalStatus.deleteMany({ where: { athleteId } });
  return NextResponse.json({ success: true, status: "AVAILABLE" });
}
