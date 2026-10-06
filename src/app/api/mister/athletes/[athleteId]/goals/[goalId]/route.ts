import { NextResponse } from "next/server";
import type { AthletePersonalGoalStatus } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import {
  ACTIVE_PERSONAL_GOAL_STATUSES,
  isActivePersonalGoalStatus,
  validatePersonalGoalActiveLimit,
  type PersonalGoalStatus,
} from "@/lib/athlete-personal-goals";
import { prisma } from "@/lib/prisma";
import { updateAthletePersonalGoalSchema } from "@/lib/validation/athlete-profile";

type RouteContext = {
  params: Promise<{ athleteId: string; goalId: string }>;
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
      error: "Non puoi gestire gli obiettivi di questo atleta.",
    };
  }

  return { ok: true as const };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { athleteId, goalId } = await context.params;
  if (!athleteId || !goalId) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
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

  const parsed = updateAthletePersonalGoalSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  try {
    const goal = await prisma.$transaction(async (tx) => {
      const existing = await tx.athletePersonalGoal.findFirst({
        where: { id: goalId, athleteId },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw Object.assign(new Error("Obiettivo non trovato."), { status: 404 });
      }

      const nextStatus = (parsed.data.status ?? existing.status) as PersonalGoalStatus;
      const wasActive = isActivePersonalGoalStatus(existing.status as PersonalGoalStatus);
      const willBeActive = isActivePersonalGoalStatus(nextStatus);

      if (willBeActive && !wasActive) {
        const activeCount = await tx.athletePersonalGoal.count({
          where: {
            athleteId,
            status: { in: [...ACTIVE_PERSONAL_GOAL_STATUSES] },
          },
        });
        const limit = validatePersonalGoalActiveLimit({
          existingActiveCount: activeCount,
          nextStatus,
        });
        if (!limit.ok) {
          throw Object.assign(new Error(limit.error), { status: 409 });
        }
      }

      return tx.athletePersonalGoal.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.text !== undefined ? { text: parsed.data.text } : {}),
          ...(parsed.data.status !== undefined
            ? { status: parsed.data.status as AthletePersonalGoalStatus }
            : {}),
          ...(parsed.data.periodMonth !== undefined
            ? { periodMonth: parsed.data.periodMonth }
            : {}),
          ...(parsed.data.periodYear !== undefined
            ? { periodYear: parsed.data.periodYear }
            : {}),
          authorId: session.user.id,
        },
        select: {
          id: true,
          text: true,
          status: true,
          periodMonth: true,
          periodYear: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return NextResponse.json({ success: true, goal });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    const message = error instanceof Error ? error.message : "Aggiornamento non riuscito.";
    return NextResponse.json({ error: message }, { status: status || 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { athleteId, goalId } = await context.params;
  if (!athleteId || !goalId) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const access = await assertCanManageAthlete({
    userId: session.user.id,
    role: session.user.role,
    athleteId,
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const existing = await prisma.athletePersonalGoal.findFirst({
    where: { id: goalId, athleteId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Obiettivo non trovato." }, { status: 404 });
  }

  await prisma.athletePersonalGoal.delete({ where: { id: existing.id } });
  return NextResponse.json({ success: true });
}
