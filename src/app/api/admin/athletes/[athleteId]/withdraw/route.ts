import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  decideWithdrawAthlete,
  ATHLETE_WITHDRAW_CONFIRM_TOKEN,
} from "@/lib/athlete-roster-status";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ athleteId: string }>;
};

/**
 * POST body: { confirmToken: "RITIRA", reason?: string }
 * Ritira atleta anche se ha pagamenti PAID. Non tocca Payment/Receipt/Accounting.
 */
export async function POST(request: Request, context: RouteContext) {
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const body = payload as { confirmToken?: unknown; reason?: unknown };

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

  const decision = decideWithdrawAthlete({
    rosterStatus: athlete.rosterStatus,
    confirmToken: body.confirmToken,
    reason: body.reason,
    withdrawnAt: nowAsEuropeRomeWallClockUtc(),
  });
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
    message: "Atleta ritirato. Storico pagamenti e documenti conservati.",
    confirmHint: ATHLETE_WITHDRAW_CONFIRM_TOKEN,
    data: updated,
  });
}
