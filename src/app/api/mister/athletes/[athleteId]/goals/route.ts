import { NextResponse } from "next/server";
import type { AthletePersonalGoalStatus } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import {
  ACTIVE_PERSONAL_GOAL_STATUSES,
  validatePersonalGoalActiveLimit,
  type PersonalGoalStatus,
} from "@/lib/athlete-personal-goals";
import { prisma } from "@/lib/prisma";
import { createAthletePersonalGoalSchema } from "@/lib/validation/athlete-profile";

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
      error: "Non puoi gestire gli obiettivi di questo atleta.",
    };
  }

  return { ok: true as const, categoryId };
}

export async function GET(_request: Request, context: RouteContext) {
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

  const goals = await prisma.athletePersonalGoal.findMany({
    where: { athleteId },
    orderBy: [{ updatedAt: "desc" }],
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

  return NextResponse.json({ success: true, goals });
}

export async function POST(request: Request, context: RouteContext) {
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

  const parsed = createAthletePersonalGoalSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const nextStatus = parsed.data.status as PersonalGoalStatus;

  try {
    const goal = await prisma.$transaction(async (tx) => {
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
        throw new Error(limit.error);
      }

      return tx.athletePersonalGoal.create({
        data: {
          athleteId,
          authorId: session.user.id,
          text: parsed.data.text,
          status: nextStatus as AthletePersonalGoalStatus,
          periodMonth: parsed.data.periodMonth ?? null,
          periodYear: parsed.data.periodYear ?? null,
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

    return NextResponse.json({ success: true, goal }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Salvataggio non riuscito.";
    const isLimit = message.includes("Massimo");
    return NextResponse.json({ error: message }, { status: isLimit ? 409 : 400 });
  }
}
