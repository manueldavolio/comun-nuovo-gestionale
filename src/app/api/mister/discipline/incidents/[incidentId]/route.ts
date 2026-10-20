import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory } from "@/lib/athlete-access";
import { writeDisciplinaryAudit } from "@/lib/discipline-audit";
import {
  isDisciplinarySanctionType,
  normalizeOptionalMinute,
  normalizeOptionalNotes,
} from "@/lib/discipline";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ incidentId: string }> };

async function assertCanManageIncident(incidentId: string, userId: string, role: string) {
  const incident = await prisma.disciplinaryIncident.findUnique({
    where: { id: incidentId },
  });
  if (!incident) return { error: "Provvedimento non trovato.", status: 404 as const };
  const allowed = await canManageAthleteCategory({
    userId,
    role: role as "ADMIN" | "YOUTH_DIRECTOR" | "COACH" | "PARENT",
    categoryId: incident.categoryId,
  });
  if (!allowed) return { error: "Operazione non consentita.", status: 403 as const };
  return { incident };
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const { incidentId } = await context.params;
  const gate = await assertCanManageIncident(incidentId, session.user.id, session.user.role);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (gate.incident.status === "VOIDED") {
    return NextResponse.json({ error: "Provvedimento annullato." }, { status: 409 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  const body = payload as { type?: unknown; minute?: unknown; notes?: unknown };

  const data: {
    type?: typeof gate.incident.type;
    minute?: number | null;
    notes?: string | null;
    updatedById: string;
  } = { updatedById: session.user.id };

  if (body.type !== undefined) {
    if (!isDisciplinarySanctionType(body.type)) {
      return NextResponse.json({ error: "Tipo non valido." }, { status: 400 });
    }
    data.type = body.type;
  }
  if (body.minute !== undefined) {
    const minute = normalizeOptionalMinute(body.minute);
    if (!minute.ok) return NextResponse.json({ error: minute.error }, { status: 400 });
    data.minute = minute.minute;
  }
  if (body.notes !== undefined) {
    const notes = normalizeOptionalNotes(body.notes);
    if (!notes.ok) return NextResponse.json({ error: notes.error }, { status: 400 });
    data.notes = notes.notes;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.disciplinaryIncident.update({
      where: { id: incidentId },
      data,
    });
    await writeDisciplinaryAudit({
      tx,
      entityType: "INCIDENT",
      entityId: row.id,
      action: "UPDATE",
      userId: session.user.id,
      before: gate.incident,
      after: row,
    });
    return row;
  });

  return NextResponse.json({ success: true, data: updated });
}

/** Soft-void: non elimina lo storico. */
export async function DELETE(request: Request, context: RouteContext) {
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

  const { incidentId } = await context.params;
  const gate = await assertCanManageIncident(incidentId, session.user.id, session.user.role);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (gate.incident.status === "VOIDED") {
    return NextResponse.json({ error: "Già annullato." }, { status: 409 });
  }

  let voidReason: string | null = null;
  try {
    const payload = (await request.json()) as { voidReason?: unknown };
    if (typeof payload.voidReason === "string") {
      voidReason = payload.voidReason.trim().slice(0, 300) || null;
    }
  } catch {
    // body opzionale
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.disciplinaryIncident.update({
      where: { id: incidentId },
      data: {
        status: "VOIDED",
        voidedAt: nowAsEuropeRomeWallClockUtc(),
        voidReason,
        updatedById: session.user.id,
      },
    });
    await writeDisciplinaryAudit({
      tx,
      entityType: "INCIDENT",
      entityId: row.id,
      action: "VOID",
      userId: session.user.id,
      before: gate.incident,
      after: row,
    });
    return row;
  });

  return NextResponse.json({ success: true, data: updated });
}
