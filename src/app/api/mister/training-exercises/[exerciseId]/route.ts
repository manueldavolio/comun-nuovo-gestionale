import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStaffAllowedCategoryIds } from "@/lib/session-tools-access";
import {
  canManageTrainingExercise,
  normalizeDurationMin,
  normalizeOptionalText,
  normalizeTrainingTitle,
  TRAINING_DESCRIPTION_MAX,
  TRAINING_MATERIALS_MAX,
} from "@/lib/training-session";

type RouteContext = {
  params: Promise<{ exerciseId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { exerciseId } = await context.params;
  const existing = await prisma.trainingExercise.findUnique({
    where: { id: exerciseId },
    select: {
      id: true,
      createdById: true,
      categoryId: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Esercizio non trovato." }, { status: 404 });
  }

  const allowedCategoryIds = await getStaffAllowedCategoryIds({
    userId: session.user.id,
    role: session.user.role,
  });
  if (
    !canManageTrainingExercise({
      role: session.user.role,
      userId: session.user.id,
      allowedCategoryIds,
      exercise: existing,
    })
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
    title?: unknown;
    description?: unknown;
    durationMin?: unknown;
    materials?: unknown;
    categoryId?: unknown;
  };

  const data: {
    title?: string;
    description?: string | null;
    durationMin?: number | null;
    materials?: string | null;
    categoryId?: string | null;
  } = {};

  if (body.title !== undefined) {
    const titleResult = normalizeTrainingTitle(body.title);
    if (!titleResult.ok) {
      return NextResponse.json({ error: titleResult.error }, { status: 400 });
    }
    data.title = titleResult.title;
  }
  if (body.description !== undefined) {
    const descResult = normalizeOptionalText(
      body.description,
      TRAINING_DESCRIPTION_MAX,
      "Descrizione",
    );
    if (!descResult.ok) {
      return NextResponse.json({ error: descResult.error }, { status: 400 });
    }
    data.description = descResult.value;
  }
  if (body.materials !== undefined) {
    const materialsResult = normalizeOptionalText(
      body.materials,
      TRAINING_MATERIALS_MAX,
      "Materiale",
    );
    if (!materialsResult.ok) {
      return NextResponse.json({ error: materialsResult.error }, { status: 400 });
    }
    data.materials = materialsResult.value;
  }
  if (body.durationMin !== undefined) {
    const durResult = normalizeDurationMin(body.durationMin);
    if (!durResult.ok) {
      return NextResponse.json({ error: durResult.error }, { status: 400 });
    }
    data.durationMin = durResult.durationMin;
  }
  if (body.categoryId !== undefined) {
    if (body.categoryId == null || body.categoryId === "") {
      data.categoryId = null;
    } else if (typeof body.categoryId === "string") {
      if (
        session.user.role === "COACH" &&
        !allowedCategoryIds.includes(body.categoryId)
      ) {
        return NextResponse.json({ error: "Categoria non consentita." }, { status: 403 });
      }
      data.categoryId = body.categoryId;
    } else {
      return NextResponse.json({ error: "Categoria non valida." }, { status: 400 });
    }
  }

  const exercise = await prisma.trainingExercise.update({
    where: { id: exerciseId },
    data,
    select: {
      id: true,
      title: true,
      description: true,
      durationMin: true,
      materials: true,
      categoryId: true,
      createdById: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ exercise });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const { exerciseId } = await context.params;
  const existing = await prisma.trainingExercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, createdById: true, categoryId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Esercizio non trovato." }, { status: 404 });
  }

  const allowedCategoryIds = await getStaffAllowedCategoryIds({
    userId: session.user.id,
    role: session.user.role,
  });
  if (
    !canManageTrainingExercise({
      role: session.user.role,
      userId: session.user.id,
      allowedCategoryIds,
      exercise: existing,
    })
  ) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  // SET NULL su TrainingSessionItem.exerciseId — le sedute storiche restano intatte (snapshot).
  await prisma.trainingExercise.delete({ where: { id: exerciseId } });
  return NextResponse.json({ ok: true });
}
