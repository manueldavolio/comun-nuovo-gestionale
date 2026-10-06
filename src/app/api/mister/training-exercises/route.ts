import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStaffAllowedCategoryIds } from "@/lib/session-tools-access";
import {
  buildExerciseLibraryWhere,
  normalizeDurationMin,
  normalizeOptionalText,
  normalizeTrainingTitle,
  TRAINING_DESCRIPTION_MAX,
  TRAINING_MATERIALS_MAX,
} from "@/lib/training-session";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR" &&
    session.user.role !== "COACH"
  ) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const url = new URL(request.url);
  const categoryIdFilter = url.searchParams.get("categoryId");

  const allowedCategoryIds = await getStaffAllowedCategoryIds({
    userId: session.user.id,
    role: session.user.role,
  });

  if (
    categoryIdFilter &&
    session.user.role === "COACH" &&
    !allowedCategoryIds.includes(categoryIdFilter)
  ) {
    return NextResponse.json({ error: "Categoria non consentita." }, { status: 403 });
  }

  const where = buildExerciseLibraryWhere({
    role: session.user.role,
    userId: session.user.id,
    allowedCategoryIds,
    categoryIdFilter,
  }) as Prisma.TrainingExerciseWhereInput;

  const exercises = await prisma.trainingExercise.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
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

  return NextResponse.json({ exercises });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR" &&
    session.user.role !== "COACH"
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

  const titleResult = normalizeTrainingTitle(body.title);
  if (!titleResult.ok) {
    return NextResponse.json({ error: titleResult.error }, { status: 400 });
  }
  const descResult = normalizeOptionalText(
    body.description,
    TRAINING_DESCRIPTION_MAX,
    "Descrizione",
  );
  if (!descResult.ok) {
    return NextResponse.json({ error: descResult.error }, { status: 400 });
  }
  const materialsResult = normalizeOptionalText(
    body.materials,
    TRAINING_MATERIALS_MAX,
    "Materiale",
  );
  if (!materialsResult.ok) {
    return NextResponse.json({ error: materialsResult.error }, { status: 400 });
  }
  const durResult = normalizeDurationMin(body.durationMin);
  if (!durResult.ok) {
    return NextResponse.json({ error: durResult.error }, { status: 400 });
  }

  let categoryId: string | null = null;
  if (body.categoryId != null && body.categoryId !== "") {
    if (typeof body.categoryId !== "string") {
      return NextResponse.json({ error: "Categoria non valida." }, { status: 400 });
    }
    categoryId = body.categoryId;
    const allowed = await getStaffAllowedCategoryIds({
      userId: session.user.id,
      role: session.user.role,
    });
    if (session.user.role === "COACH" && !allowed.includes(categoryId)) {
      return NextResponse.json({ error: "Categoria non consentita." }, { status: 403 });
    }
    const cat = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!cat) {
      return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
    }
  }

  const exercise = await prisma.trainingExercise.create({
    data: {
      title: titleResult.title,
      description: descResult.value,
      durationMin: durResult.durationMin,
      materials: materialsResult.value,
      categoryId,
      createdById: session.user.id,
    },
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

  return NextResponse.json({ exercise }, { status: 201 });
}
