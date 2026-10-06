import Link from "next/link";
import { redirect } from "next/navigation";
import { TrainingSessionEditor } from "@/components/mister/training-session-editor";
import { getAuthSession } from "@/lib/auth";
import { canManageEventAttendance, getCoachCategoryIdsForUser } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { buildExerciseLibraryWhere, isTrainingEventType } from "@/lib/training-session";
import type { Prisma } from "@prisma/client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MisterTrainingSessionPage({ params }: PageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister");
  }
  if (
    session.user.role !== "COACH" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR"
  ) {
    redirect("/unauthorized");
  }

  const { id: eventId } = await params;
  const canManage = await canManageEventAttendance({
    userId: session.user.id,
    role: session.user.role,
    eventId,
  });
  if (!canManage) {
    redirect("/unauthorized");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      type: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
      trainingSession: {
        select: {
          notes: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              exerciseId: true,
              title: true,
              description: true,
              durationMin: true,
            },
          },
        },
      },
    },
  });

  if (!event || !isTrainingEventType(event.type)) {
    redirect("/unauthorized");
  }

  const allowedCategoryIds =
    session.user.role === "COACH"
      ? await getCoachCategoryIdsForUser(session.user.id)
      : (
          await prisma.category.findMany({
            where: { isActive: true },
            select: { id: true },
          })
        ).map((c) => c.id);

  const where = buildExerciseLibraryWhere({
    role: session.user.role,
    userId: session.user.id,
    allowedCategoryIds,
    categoryIdFilter: event.categoryId,
  }) as Prisma.TrainingExerciseWhereInput;

  const libraryExercises = await prisma.trainingExercise.findMany({
    where,
    orderBy: [{ title: "asc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      durationMin: true,
    },
  });

  const backHref = `/mister/eventi/${event.id}/presenze`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-[720px]">
        <TrainingSessionEditor
          eventId={event.id}
          eventTitle={event.title}
          categoryName={event.category?.name ?? null}
          backHref={backHref}
          initialNotes={event.trainingSession?.notes ?? ""}
          initialItems={(event.trainingSession?.items ?? []).map((item) => ({
            key: item.id,
            exerciseId: item.exerciseId,
            title: item.title,
            description: item.description ?? "",
            durationMin: item.durationMin == null ? "" : String(item.durationMin),
          }))}
          libraryExercises={libraryExercises}
        />
        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link href="/mister/libreria-esercizi" className="text-blue-800 underline">
            Gestisci libreria
          </Link>
        </p>
      </div>
    </main>
  );
}
